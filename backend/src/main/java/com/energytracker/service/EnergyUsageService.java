package com.energytracker.service;
import com.energytracker.*;
import com.energytracker.dto.*;
import com.energytracker.model.*;
import com.energytracker.repository.*;
import com.energytracker.service.*;
import com.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EnergyUsageService {
    private static final Logger logger = LoggerFactory.getLogger(EnergyUsageService.class);

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private final UserSettingsService userSettingsService;
    private final TimeSeriesForecaster forecaster;
    private final UserService userService;
    private final NotificationService notificationService;
    private static final Map<Integer, Double> SEASONAL_FACTORS = Map.ofEntries(
        Map.entry(0, 1.05), Map.entry(1, 1.02), Map.entry(2, 0.98),
        Map.entry(3, 0.95), Map.entry(4, 0.95), Map.entry(5, 1.10),
        Map.entry(6, 1.15), Map.entry(7, 1.15), Map.entry(8, 1.05),
        Map.entry(9, 1.00), Map.entry(10, 0.98), Map.entry(11, 1.05)
    );
    private static final double NOISE_BOUND = 0.05;
    private static final int MIN_HISTORY_DAYS = 30;
    private static final double DEFAULT_RATE = 0.12; // or 0.15 if you prefer


    public EnergyUsageService(
      EnergyUsageLogRepository logRepo,
      ApplianceRepository applianceRepo,
      UserSettingsService userSettingsService,
      TimeSeriesForecaster forecaster,
        UserService userService,
        NotificationService notificationService
    ) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
        this.userSettingsService = userSettingsService;
        this.forecaster = forecaster;
        this.userService = userService;
        this.notificationService = notificationService;

    }


    // ————————————————————————————————————————————————————————————————
    // Helpers
    // ————————————————————————————————————————————————————————————————

    /** Load only active appliances (userId==null will fetch global defaults) */
    // in EnergyUsageService
public List<Appliance> getAppliances(Long userId) {
    return applianceRepo.findAllByUserIdAndActiveTrueAndDeletedFalse(userId);
}


    /** Pull user's rate, or default 0.12 if missing (guests) */
    private double getRate(Long userId) {
        return userSettingsService.getSettingsByUserId(userId)
            .map(UserSettings::getElectricityRatePerKWh)
            .filter(rate -> rate != null && rate > 0.0000001) // treat <=0 as unset
            .orElse(DEFAULT_RATE);
    }
    
    

    // ————————————————————————————————————————————————————————————————
    // Average Rate & Fallbacks
    // ————————————————————————————————————————————————————————————————

    public double getAverageRate(Long userId) {
        double rate = getRate(userId);
        List<EnergyUsageLog> logs = logRepo.findAllByUserId(userId).stream()
            .filter(l -> l.getAppliance() != null && l.getAppliance().isActive() && !l.getAppliance().isDeleted())
            .collect(Collectors.toList());

        double totalKWh = 0, totalCost = 0;
        for (var log : logs) {
            double k = log.getKWhUsed();
            totalKWh += k;
            totalCost += k * rate;
        }
        return (totalKWh == 0) ? rate : totalCost / totalKWh;
    }

    public Double getFallbackEstimate()    { return 1200.0; }
    public Double getFallbackDailyCost()  { return 3.50; }

    // ————————————————————————————————————————————————————————————————
    // Usage Data
    // ————————————————————————————————————————————————————————————————

    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getUsageDataByUser(Long userId, LocalDate start, LocalDate end) {
        if (userId == null) {
            return getFallbackUsageData(start, end);
        }
        return logRepo.findUsageBetween(userId, start, end);
    }

    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getFallbackUsageData(LocalDate start, LocalDate end) {
        LocalDate today = LocalDate.now();
        LocalDate from  = (start != null) ? start : today.minusDays(6);
        LocalDate to    = (end   != null) ? end   : today;
        List<EnergyUsageDTO> out = new ArrayList<>();
        Random rnd = new Random(42);
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            out.add(new EnergyUsageDTO(d, null, "Fallback", 5 + rnd.nextDouble() * 10));
        }
        return out;
    }

    // ————————————————————————————————————————————————————————————————
    // Summaries
    // ————————————————————————————————————————————————————————————————

    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummary(Long userId) {
        if (userId == null) return getFallbackUsageSummary(30);
        List<EnergyUsageLog> entries = logRepo.findAllByUserId(userId).stream()
            .filter(e -> e.getAppliance() != null && e.getAppliance().isActive() && !e.getAppliance().isDeleted())
            .collect(Collectors.toList());

        double rate = getRate(userId), totalKwh = 0, totalCost = 0;
        Set<LocalDate> daysUsed = new HashSet<>();
        for (var e : entries) {
            totalKwh += e.getKWhUsed();
            totalCost += e.getKWhUsed() * rate;
            daysUsed.add(e.getDate());
        }
        double avgKwh = daysUsed.isEmpty() ? 0 : totalKwh / daysUsed.size();
        return new UsageSummaryDTO(totalKwh, totalCost, avgKwh * rate);
    }

    public UsageSummaryDTO getFallbackUsageSummary(Integer days) {
        double total = 100, cost = 120;
        double avg   = (days != null && days > 0) ? total / days : total / 30.0;
        return new UsageSummaryDTO(total, cost, avg);
    }

    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummaryForRange(Long userId, int days) {
        if (userId == null) return getFallbackUsageSummary(days);
        LocalDate end   = LocalDate.now();
        LocalDate start = end.minusDays(days - 1);
        Map<LocalDate, Double> daily = new HashMap<>();
        logRepo.findAllByUserId(userId).stream()
            .filter(e -> e.getAppliance() != null && e.getAppliance().isActive() && !e.getAppliance().isDeleted())
            .filter(e -> !e.getDate().isBefore(start) && !e.getDate().isAfter(end))
            .forEach(e -> daily.merge(e.getDate(), e.getKWhUsed(), Double::sum));

        double totalKwh = daily.values().stream().mapToDouble(d -> d).sum();
        double rate     = getRate(userId);
        double totalCost= totalKwh * rate;
        double avgCost  = daily.isEmpty() ? 0 : totalCost / daily.size();
        return new UsageSummaryDTO(totalKwh, totalCost, avgCost);
    }

    // ————————————————————————————————————————————————————————————————
    // Projections
    // ————————————————————————————————————————————————————————————————

    @Transactional(readOnly = true)
    public List<UsageProjectionDTO> getProjections(Long userId, String timeRange) {
        List<Appliance> apps   = getAppliances(userId);
        double rate            = getRate(userId);
    
        // Decide whether to use model forecast (requires sufficient history).
        boolean forecast = false;
        if (userId != null) {
            long hist = logRepo.findAllByUserId(userId).stream()
                .filter(e -> e.getAppliance() != null && e.getAppliance().isActive() && !e.getAppliance().isDeleted())
                .map(EnergyUsageLog::getDate)
                .distinct()
                .count();
            forecast = hist >= MIN_HISTORY_DAYS; // reuse your existing MIN_HISTORY_DAYS
            logger.info("getProjections - userId={}, historyDays={}, forecastEnabled={}", userId, hist, forecast);
        }
    
        return switch (timeRange.toLowerCase()) {
            case "daily"   -> project(apps, rate, 1, 30, forecast, "yyyy-MM-dd");
            case "weekly"  -> project(apps, rate, 7,  4, forecast, "yyyy-MM-dd");
            case "monthly" -> project(apps, rate, -1, 6, forecast, "MMM yyyy");
            default        -> throw new IllegalArgumentException("Invalid timeRange");
        };
    }
    

/**
 * Annual cost forecast.
 */
@Transactional(readOnly = true)
public Double getAnnualCostForecast(Long userId) {
    logger.info("getAnnualCostForecast called for userId={}", userId);

    // --- Guest fallback ---
    if (userId == null) {
        Double fallback = getFallbackEstimate();
        logger.info("No userId provided, returning fallback annual cost estimate: {}", fallback);
        return fallback;
    }

    // --- Logged-in user ---
    List<Appliance> apps = getAppliances(userId);
    logger.info("Appliances fetched for user {}: {}", userId, 
                apps.stream().map(Appliance::getName).toList());

                if (apps.isEmpty()) {
                    logger.warn("No appliances found for userId={}, returning fallback");
                    return getFallbackEstimate();
                }
                

    // pull or default their rate
    double rate = userSettingsService
                     .getUserSettings(userId)
                     .getElectricityRatePerKWh();

    // decide whether to use forecast
    long hist = logRepo.findAllByUserId(userId).stream()
                .filter(e -> e.getAppliance() != null && e.getAppliance().isActive() && !e.getAppliance().isDeleted())
                .map(EnergyUsageLog::getDate)
                .distinct()
                .count();
    boolean forecast = hist >= MIN_HISTORY_DAYS;
    logger.info("UserId={} has {} days history, forecast={}", userId, hist, forecast);

    // generate 12-month projection
    List<UsageProjectionDTO> monthly = project(apps, rate, -1, 12, forecast, "MMM yyyy");

    // log each
    monthly.forEach(dto ->
        logger.info("[AnnualForecast] Month: {}, TotalCost: {}, ByApp: {}",
                    dto.getDate(), dto.getTotalCost(), dto.getByAppCost())
    );

    double totalCost = monthly.stream()
                        .mapToDouble(UsageProjectionDTO::getTotalCost)
                        .sum();
    logger.info("Calculated annual cost forecast for userId={} is {}", userId, totalCost);
    return totalCost;
}

/**
 * Daily cost forecast.
 */
@Transactional(readOnly = true)
public Double getForecastedDailyCost(Long userId) {
    logger.info("getForecastedDailyCost called for userId={}", userId);

    // --- Guest fallback ---
    if (userId == null) {
        Double fallback = getFallbackDailyCost();
        logger.info("No userId provided, returning fallback daily cost estimate: {}", fallback);
        return fallback;
    }

    // --- Logged-in user ---
    List<Appliance> apps = getAppliances(userId);
    logger.info("Found {} appliances for userId={}", apps.size(), userId);
    if (apps.isEmpty()) {
        logger.warn("No appliances found for userId={}, returning 0.0", userId);
        return 0.0;
    }

    double rate = userSettingsService
                     .getUserSettings(userId)
                     .getElectricityRatePerKWh();

    long hist = logRepo.findAllByUserId(userId).stream()
                .filter(e -> e.getAppliance() != null && e.getAppliance().isActive() && !e.getAppliance().isDeleted())
                .map(EnergyUsageLog::getDate)
                .distinct()
                .count();
    boolean useForecast = hist >= MIN_HISTORY_DAYS;
    logger.info("UserId={} has {} days history, useForecast={}", userId, hist, useForecast);

    // one-day projection = project with count=1 & daysPer=1
    UsageProjectionDTO todayDto = project(apps, rate, 1, 1, useForecast, "yyyy-MM-dd").get(0);
    double dailyCost = todayDto.getTotalCost();
    logger.info("✅ Forecasted daily cost for userId={} is ${}, Breakdown: {}",
                userId, dailyCost, todayDto.getByAppCost());
    return dailyCost;
}



    @Transactional
public EnergyUsageLog logUsage(Long applianceId, LocalDate date, double kWhUsed) {
    logger.info("logUsage called with applianceId={}, date={}, kWhUsed={}", applianceId, date, kWhUsed);

    // Step 1: Check if appliance exists and is active
    var appOpt = applianceRepo.findById(applianceId)
    .filter(a -> a.isActive() && !a.isDeleted());

    if (appOpt.isEmpty()) {
        logger.warn("Appliance not found or inactive: applianceId={}", applianceId);
        throw new IllegalArgumentException("Appliance not found or inactive");
    }

    var app = appOpt.get();

    // Step 2: Prevent duplicate usage logs for the same day
    boolean usageExists = logRepo.findByApplianceIdAndDate(applianceId, date).isPresent();
    if (usageExists) {
        logger.warn("Usage already logged for applianceId={} on date={}", applianceId, date);
        throw new IllegalArgumentException("Usage already logged on " + date);
    }

    // Step 3: Save the usage log
    var entry = new EnergyUsageLog();
    entry.setAppliance(app);
    entry.setDate(date);
    entry.setKWhUsed(kWhUsed);

    var saved = logRepo.save(entry);
    logger.info("Saved EnergyUsageLog with id={}", saved.getId());

    // Step 4: High usage notification (only for logged-in users)
    if (app.getUser() != null) {
        double baseKWh = (app.getWattage() * app.getHoursPerDay()) / 1000.0;
        if (kWhUsed > baseKWh * 1.2) {
            var user = userService.getUserById(app.getUser().getId());
            logger.info("High usage detected, creating notification for userId={}, applianceId={}, date={}, usage={}",
                        user.getId(), applianceId, date, kWhUsed);
            notificationService.createHighUsageNotificationIfNotExists(
                user, applianceId, app.getName(), date, kWhUsed
            );
        }
    } else {
        logger.info("No user associated with applianceId={}, skipping notification", applianceId);
    }

    return saved;
}

 /**
 * Core projection loop — always takes an explicit rate
 */
public List<UsageProjectionDTO> project(
    List<Appliance> apps,
    double rate,
    int periodDays,
    int count,
    boolean useForecast,
    String datePattern
) {
    DateTimeFormatter fmt = DateTimeFormatter.ofPattern(datePattern);
    LocalDate today = LocalDate.now();
    List<UsageProjectionDTO> out = new ArrayList<>();

    for (int i = 1; i <= count; i++) {
        // advance by days or months
        LocalDate date = (periodDays > 0)
            ? today.plusDays((long) i * periodDays)
            : today.plusMonths(i);

        int days = (periodDays > 0)
            ? periodDays
            : date.lengthOfMonth();

        // compute one point
        UsageProjectionDTO dto = projectPoint(apps, date, days, useForecast, rate);

        // if monthly, format the label differently
        if (periodDays < 0) {
            dto = new UsageProjectionDTO(
                date.format(fmt),
                dto.getTotalCost(),
                dto.getByAppCost()
            );
        }

        out.add(dto);
    }

    return out;
}

/**
 * Single-point projection — uses only the passed-in rate for cost
 */
// In your class where projectPoint is defined
public UsageProjectionDTO projectPoint(
    List<Appliance> apps,
    LocalDate date,
    int days,
    boolean useForecast,
    double rate
) {
    double season = SEASONAL_FACTORS.getOrDefault(date.getMonthValue() - 1, 1.0);
    double totalCost = 0;
    Map<String, Double> byApp = new LinkedHashMap<>();

    for (Appliance a : apps) {
        // baseline kWh/day
        double fallback = (a.getWattage() * a.getHoursPerDay()) / 1000.0;
        double perDay = fallback;

        // potentially use forecast
        if (useForecast && a.getId() != null && a.getId() > 0) {
            perDay = Math.min(
                forecaster.forecastNext(a.getId(), MIN_HISTORY_DAYS),
                TimeSeriesForecaster.MAX_KWH_PER_DAY
            );
        }
        // guard against over-forecast
        if (perDay > TimeSeriesForecaster.MAX_KWH_PER_DAY) {
            perDay = fallback;
        }

        // apply seasonal, trend & noise
        double baseKwh = perDay * days;
        double withSeason = baseKwh * season;
        double trend = computeTrendFactor(a.getId());
        long seed = Objects.hash(a.getId(), date.toEpochDay());
        double noise = 1 + (new Random(seed).nextDouble() * 2 * NOISE_BOUND - NOISE_BOUND);

        // clamp to realistic max
        double kwh = Math.min(
            withSeason * trend * noise,
            TimeSeriesForecaster.MAX_KWH_PER_DAY * days
        );

        // compute cost
        double cost = kwh * rate;
        byApp.put(a.getName(), cost);
        totalCost += cost;

        logger.debug("[ProjectPoint] Appliance: {}, fallback: {}, perDay forecast: {}, season: {}, trend: {}, noise: {}, kwh: {}, cost: {}",
            a.getName(), fallback, perDay, season, trend, noise, kwh, cost);
    }

    logger.debug("[ProjectPoint] Date: {}, Days: {}, Total cost: {}", date, days, totalCost);

    return new UsageProjectionDTO(date.toString(), totalCost, byApp);
}


    // ————————————————————————————————————————————————————————————————
    // Trend & Daily‐Usage Helpers
    // ————————————————————————————————————————————————————————————————

    private double computeTrendFactor(Long applianceId) {
        LocalDate end   = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(29);
        List<Map.Entry<LocalDate, Double>> entries = logRepo
          .findByApplianceIdAndDateBetween(applianceId, start, end).stream()
          .filter(e -> e.getAppliance() != null 
          && e.getAppliance().isActive() 
          && !e.getAppliance().isDeleted())
          .collect(Collectors.groupingBy(EnergyUsageLog::getDate,
                   Collectors.summingDouble(EnergyUsageLog::getKWhUsed)))
          .entrySet().stream()
          .sorted(Map.Entry.comparingByKey())
          .toList();

        if (entries.size() < 2) return 1.0;
        int n = entries.size(), i = 0;
        double sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (var e : entries) {
            sumX  += i;
            sumY  += e.getValue();
            sumXY += i * e.getValue();
            sumXX += i * i;
            i++;
        }
        double slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX);
        double meanY = sumY / n;
        return (meanY == 0) ? 1.0 : Math.max(0.9, Math.min(1.1, 1 + slope/meanY));
    }

    @Transactional(readOnly = true)
    public double getTotalKwhForDate(Long userId, LocalDate date) {
        return logRepo.findUsageBetween(userId, date, date)
                      .stream()
                      .mapToDouble(EnergyUsageDTO::getkWhUsed)
                      .sum();
    }
}
