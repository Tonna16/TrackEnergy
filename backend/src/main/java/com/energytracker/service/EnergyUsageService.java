package com.energytracker.service;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
        Map.entry(3, 0.95), Map.entry(4, 1.00), Map.entry(5, 1.10),
        Map.entry(6, 1.15), Map.entry(7, 1.15), Map.entry(8, 1.05),
        Map.entry(9, 1.00), Map.entry(10, 0.98), Map.entry(11, 1.05)
    );
    private static final double NOISE_BOUND = 0.05;
    private static final int MIN_HISTORY_DAYS = 30;

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

    // Helper: fetch appliances for a user or guest (userId == null)
    public List<Appliance> getAppliances(Long userId) {
        return applianceRepo.findAllByUserIdAndActiveTrue(userId);
    }
    

    // Helper: rate or default for guests
    private double getRate(Long userId) {
        return userSettingsService.getSettingsByUserId(userId)
            .map(s -> s.getElectricityRatePerKWh())
            .orElse(0.12);
    }
    /** 
     * Fallback annual cost estimate for guest users without history.
     * Returns a fixed average annual cost (USD).
     */
    public Double getFallbackEstimate() {
        return 1200.0;
    }

    /** 
     * Fallback daily cost estimate for guest users.
     * Returns a fixed average daily cost (USD).
     */
    public Double getFallbackDailyCost() {
        return 3.50;
    }
    /** Raw usage data for charts */
    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getUsageDataByUser(Long userId, LocalDate start, LocalDate end) {
        logger.info("getUsageDataByUser called with userId={}, start={}, end={}", userId, start, end);
    
        if (userId == null) {
            logger.info("No userId provided, returning fallback usage data.");
            return getFallbackUsageData(start, end);
        }
    
        List<EnergyUsageDTO> usageData = logRepo.findUsageBetween(userId, start, end);
        logger.info("Retrieved {} usage records for userId={}", usageData.size(), userId);
        return usageData;
    }
    

    /** Fallback raw usage data for guests */
    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getFallbackUsageData(LocalDate start, LocalDate end) {
        LocalDate today = LocalDate.now();
        LocalDate from = (start != null) ? start : today.minusDays(6);
        LocalDate to = (end != null) ? end : today;

        List<EnergyUsageDTO> fallback = new ArrayList<>();
        Random rand = new Random(42);
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            double usage = 5 + rand.nextDouble() * 10;
            fallback.add(new EnergyUsageDTO(date, null, "Fallback Estimate", usage));
        }
        return fallback;
    }

    /** Full-history summary */
    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummary(Long userId) {
        if (userId == null) return getFallbackUsageSummary(30);
        var entries = logRepo.findAllByUserId(userId);
        double rate = getRate(userId);

        double totalKwh = 0, totalCost = 0;
        Set<LocalDate> dates = new HashSet<>();
        for (var e : entries) {
            totalKwh += e.getKWhUsed();
            totalCost += e.getKWhUsed() * rate;
            dates.add(e.getDate());
        }
        double avg = dates.isEmpty() ? 0 : totalKwh / dates.size();
        return new UsageSummaryDTO(totalKwh, totalCost, avg);
    }

    /** Fallback summary */
    public UsageSummaryDTO getFallbackUsageSummary(Integer days) {
        double totalKwh = 100, totalCost = 120;
        double avg = (days != null && days > 0) ? totalKwh / days : totalKwh / 30.0;
        return new UsageSummaryDTO(totalKwh, totalCost, avg);
    }

    /** Last‑N‑days summary */
    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummaryForRange(Long userId, int days) {
        if (userId == null) return getFallbackUsageSummary(days);
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1);
        var entries = logRepo.findAllByUserId(userId).stream()
            .filter(e -> !e.getDate().isBefore(start) && !e.getDate().isAfter(end))
            .collect(Collectors.toList());

        double rate = getRate(userId);
        Map<LocalDate, Double> daily = new HashMap<>();
        for (var e : entries) daily.merge(e.getDate(), e.getKWhUsed(), Double::sum);

        double total = daily.values().stream().mapToDouble(d -> d).sum();
        double avg = daily.isEmpty() ? 0 : total / daily.size();
        return new UsageSummaryDTO(total, total * rate, avg);
    }

    /** Cost projections */
    @Transactional(readOnly = true)
    public List<UsageProjectionDTO> getProjections(Long userId, String timeRange) {
        List<Appliance> apps = getAppliances(userId);
        double rate = getRate(userId);
        boolean forecast = userId != null;
        return switch (timeRange.toLowerCase()) {
            case "daily"   -> project(apps, rate, 1, 30, forecast, "yyyy-MM-dd");
            case "weekly"  -> project(apps, rate, 7, 4, !forecast, "yyyy-MM-dd");
            case "monthly" -> project(apps, rate, -1, 6, !forecast, "MMM yyyy");
            default         -> throw new IllegalArgumentException("Invalid timeRange");
        };
    }
    @Transactional(readOnly = true)
    public Double getAnnualCostForecast(Long userId) {
        logger.info("getAnnualCostForecast called for userId={}", userId);
    
        if (userId == null) {
            Double fallback = getFallbackEstimate();
            logger.info("No userId provided, returning fallback annual cost estimate: {}", fallback);
            return fallback;
        }
    
        var apps = getAppliances(userId);
        logger.info("Found {} appliances for userId={}", apps.size(), userId);
    
        if (apps.isEmpty()) {
            logger.warn("No appliances found for userId={}, returning null", userId);
            return null;
        }
    
        var settings = userSettingsService.getUserSettings(userId);
        if (settings == null) {
            logger.warn("No user settings found for userId={}, returning null", userId);
            return null;
        }
    
        double rate = settings.getElectricityRatePerKWh();
        long hist = logRepo.findAllByUserId(userId).stream()
            .map(EnergyUsageLog::getDate).distinct().count();
        logger.info("UserId={} has {} days of usage history", userId, hist);
    
        boolean forecast = hist >= MIN_HISTORY_DAYS;
        logger.info("Using forecast = {} (min required days = {})", forecast, MIN_HISTORY_DAYS);
    
        var monthly = project(apps, rate, -1, 12, forecast, "MMM yyyy");
        double totalCost = monthly.stream().mapToDouble(UsageProjectionDTO::getTotalCost).sum();
    
        logger.info("Calculated annual cost forecast for userId={} is {}", userId, totalCost);
        return totalCost;
    }
    
    /** Forecasted daily cost */
   /** Forecasted daily cost */
@Transactional(readOnly = true)
public Double getForecastedDailyCost(Long userId) {
    logger.info("getForecastedDailyCost called for userId={}", userId);

    // Handle unauthenticated users
    if (userId == null) {
        Double fallbackDaily = getFallbackDailyCost();
        logger.info("No userId provided, returning fallback daily cost estimate: {}", fallbackDaily);
        return fallbackDaily;
    }

    // Get user appliances
    var apps = getAppliances(userId);
    logger.info("Found {} appliances for userId={}", apps.size(), userId);

    // No appliances means no cost
    if (apps.isEmpty()) {
        logger.warn("No appliances found for userId={}, returning 0.0", userId);
        return 0.0;
    }

    // Calculate forecast
    double rate = getRate(userId);
    long hist = logRepo.findAllByUserId(userId).stream()
        .map(EnergyUsageLog::getDate)
        .distinct()
        .count();
    logger.info("UserId={} has {} days of usage history", userId, hist);

    boolean forecast = hist >= MIN_HISTORY_DAYS;
    logger.info("Using forecast = {} (min required days = {})", forecast, MIN_HISTORY_DAYS);

    var next = project(apps, rate, 1, 30, forecast, "yyyy-MM-dd");
    double avgDailyCost = next.stream()
        .mapToDouble(UsageProjectionDTO::getTotalCost)
        .average()
        .orElse(0.0);

    logger.info("Calculated forecasted daily cost for userId={} is {}", userId, avgDailyCost);
    return avgDailyCost;
}

    


    @Transactional
public EnergyUsageLog logUsage(Long applianceId, LocalDate date, double kWhUsed) {
    logger.info("logUsage called with applianceId={}, date={}, kWhUsed={}", applianceId, date, kWhUsed);

    var appOpt = applianceRepo.findById(applianceId);
    if (appOpt.isEmpty()) {
        logger.warn("Appliance not found: applianceId={}", applianceId);
        throw new IllegalArgumentException("Appliance not found");
    }
    var app = appOpt.get();

    boolean usageExists = logRepo.findByApplianceIdAndDate(applianceId, date).isPresent();
    if (usageExists) {
        logger.warn("Usage already logged for applianceId={} on date={}", applianceId, date);
        throw new IllegalArgumentException("Usage already logged on " + date);
    }

    var entry = new EnergyUsageLog();
    entry.setAppliance(app);
    entry.setDate(date);
    entry.setKWhUsed(kWhUsed);

    var saved = logRepo.save(entry);
    logger.info("Saved EnergyUsageLog with id={}", saved.getId());

    if (app.getUser() != null) {
        double base = (app.getWattage() * app.getHoursPerDay()) / 1000.0;
        if (kWhUsed > base * 1.2) {
            var user = userService.getUserById(app.getUser().getId());
            logger.info("High usage detected, creating notification for userId={}, applianceId={}, date={}, usage={}",
                        user.getId(), applianceId, date, kWhUsed);
            notificationService.createHighUsageNotificationIfNotExists(
                user, applianceId, app.getName(), date, kWhUsed
            );
        }
    } else {
        logger.info("No user associated with applianceId={}", applianceId);
    }

    return saved;
}

    

    

    private List<UsageProjectionDTO> project(
        List<Appliance> apps,
        double rate,
        int periodDays,
        int count,
        boolean useForecast,
        String datePattern
    ) {
        var fmt = DateTimeFormatter.ofPattern(datePattern);
        var today = LocalDate.now();
        List<UsageProjectionDTO> out = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            LocalDate date = periodDays > 0
                ? today.plusDays((long)i * periodDays)
                : today.plusMonths(i);
            int days = periodDays > 0 ? periodDays : date.lengthOfMonth();
            var dto = projectPoint(apps, rate, date, days, useForecast);
            if (periodDays < 0) {
                dto = new UsageProjectionDTO(date.format(fmt), dto.getTotalCost(), dto.getByAppCost());
            }
            out.add(dto);
        }
        return out;
    }

    private UsageProjectionDTO projectPoint(
        List<Appliance> apps,
        double rate,
        LocalDate date,
        int days,
        boolean useForecast
    ) {
        double season = SEASONAL_FACTORS.getOrDefault(date.getMonthValue() - 1, 1.0);
        double totalCost = 0;
        Map<String, Double> byApp = new LinkedHashMap<>();

        for (var a : apps) {
            double perDay = useForecast
                ? forecaster.forecastNext(a.getId(), MIN_HISTORY_DAYS)
                : (a.getWattage() * a.getHoursPerDay()) / 1000.0;

            double baseKwh = perDay * days;
            double withSeason = baseKwh * season;
            double trend = computeTrendFactor(a.getId());
            long seed = Objects.hash(a.getId(), date.toEpochDay());
            double noise = 1 + (new Random(seed).nextDouble() * 2 * NOISE_BOUND - NOISE_BOUND);
            double kwh = withSeason * trend * noise;
            double cost = kwh * rate;

            byApp.put(a.getName(), cost);
            totalCost += cost;
        }

        return new UsageProjectionDTO(date.toString(), totalCost, byApp);
    }

    private double computeTrendFactor(Long applianceId) {
        LocalDate end = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(29);
        var entries = logRepo.findByApplianceIdAndDateBetween(applianceId, start, end).stream()
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

        double slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        double meanY = sumY / n;
        return (meanY == 0) ? 1.0 : Math.max(0.9, Math.min(1.1, 1 + slope / meanY));
    }

    /** Sum of kWh for a specific day */
    @Transactional(readOnly = true)
    public double getTotalKwhForDate(Long userId, LocalDate date) {
        return logRepo.findUsageBetween(userId, date, date).stream()
                      .mapToDouble(EnergyUsageDTO::getkWhUsed)
                      .sum();
    }
}
