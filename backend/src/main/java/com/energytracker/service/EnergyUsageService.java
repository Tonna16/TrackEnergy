package com.energytracker.service;
import com.energytracker.*;
import com.energytracker.dto.*;
import com.energytracker.model.*;
import com.energytracker.repository.*;
import com.energytracker.service.*;
import com.util.*;
import org.springframework.security.access.AccessDeniedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.time.temporal.TemporalAdjusters;
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
    
    // Refined seasonal factors with more realistic variations
    private static final Map<Integer, Double> SEASONAL_FACTORS = Map.ofEntries(
        Map.entry(0, 1.12),  // Jan - Winter peak
        Map.entry(1, 1.10),  // Feb - Winter
        Map.entry(2, 1.00),  // Mar - Spring transition
        Map.entry(3, 0.95),  // Apr - Spring
        Map.entry(4, 0.93),  // May - Spring low
        Map.entry(5, 1.08),  // Jun - Summer rising
        Map.entry(6, 1.15),  // Jul - Summer peak
        Map.entry(7, 1.15),  // Aug - Summer peak
        Map.entry(8, 1.05),  // Sep - Fall transition
        Map.entry(9, 0.98),  // Oct - Fall
        Map.entry(10, 0.97), // Nov - Fall low
        Map.entry(11, 1.10)  // Dec - Winter rising
    );
    
    // Reduced noise for more stable predictions
    private static final double NOISE_BOUND = 0.03;
    
    // Increased minimum history for better accuracy (aligns with TimeSeriesForecaster OPTIMAL_HISTORY_DAYS)
    private static final int MIN_HISTORY_DAYS = 60;
    
    private static final double DEFAULT_RATE = 0.12;

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
    public List<Appliance> getAppliances(Long userId) {
        return applianceRepo.findAllByUserIdAndActiveTrueAndDeletedFalse(userId);
    }

    /** Pull user's rate, or default 0.12 if missing (guests) */
    private double getRate(Long userId) {
        return userSettingsService.getSettingsByUserId(userId)
            .map(UserSettings::getElectricityRatePerKWh)
            .filter(rate -> rate != null && rate > 0.0000001)
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
        Object[] aggregates = logRepo.summarizeUsageByUserId(userId);
        double totalKwh = ((Number) aggregates[0]).doubleValue();
        long distinctDays = ((Number) aggregates[1]).longValue();
        double rate = getRate(userId);
        double totalCost = totalKwh * rate;
        double avgKwh = distinctDays == 0 ? 0 : totalKwh / distinctDays;
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
        Object[] aggregates = logRepo.summarizeUsageByUserIdAndDateBetween(userId, start, end);
        double totalKwh = ((Number) aggregates[0]).doubleValue();
        long distinctDays = ((Number) aggregates[1]).longValue();
        double rate     = getRate(userId);
        double totalCost= totalKwh * rate;
        double avgCost  = distinctDays == 0 ? 0 : totalCost / distinctDays;
        return new UsageSummaryDTO(totalKwh, totalCost, avgCost);
    }

    // ————————————————————————————————————————————————————————————————
    // Projections
    // ————————————————————————————————————————————————————————————————

    @Transactional(readOnly = true)
    public List<UsageProjectionDTO> getProjections(Long userId, String timeRange) {
        List<Appliance> apps   = getAppliances(userId);
        double rate            = getRate(userId);
    
        boolean forecast = false;
        if (userId != null) {
            long hist = logRepo.countDistinctUsageDaysByUserId(userId);
            forecast = hist >= MIN_HISTORY_DAYS;
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

        if (userId == null) {
            Double fallback = getFallbackEstimate();
            logger.info("No userId provided, returning fallback annual cost estimate: {}", fallback);
            return fallback;
        }

        List<Appliance> apps = getAppliances(userId);
        logger.info("Appliances fetched for user {}: {}", userId, 
                    apps.stream().map(Appliance::getName).toList());

        if (apps.isEmpty()) {
            logger.warn("No appliances found for userId={}, returning fallback", userId);
            return getFallbackEstimate();
        }

        double rate = userSettingsService
                         .getUserSettings(userId)
                         .getElectricityRatePerKWh();

        long hist = logRepo.countDistinctUsageDaysByUserId(userId);
        boolean forecast = hist >= MIN_HISTORY_DAYS;
        logger.info("UserId={} has {} days history, forecast={}", userId, hist, forecast);

        List<UsageProjectionDTO> monthly = project(apps, rate, -1, 12, forecast, "MMM yyyy");

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

        if (userId == null) {
            Double fallback = getFallbackDailyCost();
            logger.info("No userId provided, returning fallback daily cost estimate: {}", fallback);
            return fallback;
        }

        List<Appliance> apps = getAppliances(userId);
        logger.info("Found {} appliances for userId={}", apps.size(), userId);
        if (apps.isEmpty()) {
            logger.warn("No appliances found for userId={}, returning 0.0", userId);
            return 0.0;
        }

        double rate = userSettingsService
                         .getUserSettings(userId)
                         .getElectricityRatePerKWh();

        long hist = logRepo.countDistinctUsageDaysByUserId(userId);
        boolean useForecast = hist >= MIN_HISTORY_DAYS;
        logger.info("UserId={} has {} days history, useForecast={}", userId, hist, useForecast);

        UsageProjectionDTO todayDto = project(apps, rate, 1, 1, useForecast, "yyyy-MM-dd").get(0);
        double dailyCost = todayDto.getTotalCost();
        logger.info("✅ Forecasted daily cost for userId={} is ${}, Breakdown: {}",
                    userId, dailyCost, todayDto.getByAppCost());
        return dailyCost;
    }

    private Long getAuthenticatedUserId() {
        return SecurityUtils.getAuthenticatedUser().getId();
    }

    @Transactional
    public EnergyUsageLog logUsage(Long applianceId, LocalDate date, double kWhUsed) {
        Long authenticatedUserId = getAuthenticatedUserId();
        logger.info("logUsage called with applianceId={}, userId={}, date={}, kWhUsed={}", applianceId, authenticatedUserId, date, kWhUsed);

        boolean applianceOwnedByCaller = applianceRepo.existsByIdAndUserId(applianceId, authenticatedUserId);
        if (!applianceOwnedByCaller) {
            if (applianceRepo.existsById(applianceId)) {
                logger.warn("Forbidden appliance write attempt by userId={} for applianceId={}", authenticatedUserId, applianceId);
                throw new AccessDeniedException("Appliance is not owned by the authenticated user");
            }
            logger.warn("Appliance not found: applianceId={} requested by userId={}", applianceId, authenticatedUserId);
            throw new NoSuchElementException("Appliance not found");
        }

        var appOpt = applianceRepo.findByIdAndUserIdAndActiveTrueAndDeletedFalse(applianceId, authenticatedUserId);
        if (appOpt.isEmpty()) {
            logger.warn("Owned appliance is inactive or deleted: applianceId={}, userId={}", applianceId, authenticatedUserId);
            throw new NoSuchElementException("Appliance not found");
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
     * Core projection loop
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
            LocalDate date = today;
            int days;
            UsageProjectionDTO dto;

            if (periodDays == 7) {
                LocalDate currentWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                LocalDate weekStart = currentWeekStart.plusWeeks(i);
                LocalDate weekEnd = weekStart.plusDays(6);
                UsageProjectionDTO weekly = projectPoint(apps, weekStart, periodDays, useForecast, rate);
                dto = new UsageProjectionDTO(
                    weekStart.toString(),
                    weekly.getTotalKwh(),
                    weekly.getTotalCost(),
                    weekly.getByAppCost(),
                    weekStart.toString(),
                    weekEnd.toString()
                );
            } else {
                date = (periodDays > 0)
                    ? today.plusDays((long) i * periodDays)
                    : today.plusMonths(i);
                days = (periodDays > 0)
                    ? periodDays
                    : date.lengthOfMonth();
                dto = projectPoint(apps, date, days, useForecast, rate);
            }

            if (periodDays < 0) {
                dto = new UsageProjectionDTO(
                    date.format(fmt),
                    dto.getTotalKwh(),
                    dto.getTotalCost(),
                    dto.getByAppCost()
                );
            }

            out.add(dto);
        }

        return out;
    }

    /**
     * Single-point projection with improved accuracy
     */
    public UsageProjectionDTO projectPoint(
        List<Appliance> apps,
        LocalDate date,
        int days,
        boolean useForecast,
        double rate
    ) {
        double season = SEASONAL_FACTORS.getOrDefault(date.getMonthValue() - 1, 1.0);
        
        // Day-of-week factor for more accurate daily variations
        double dowFactor = getDayOfWeekFactor(date);
        
        double totalKwh = 0;
        double totalCost = 0;
        Map<String, Double> byApp = new LinkedHashMap<>();

        for (Appliance a : apps) {
            double fallback = (a.getWattage() * a.getHoursPerDay()) / 1000.0;
            double perDay = fallback;

            // Use forecaster for better predictions when history exists
            if (useForecast && a.getId() != null && a.getId() > 0) {
                try {
                    perDay = forecaster.forecastNext(a.getId(), MIN_HISTORY_DAYS);
                    // Bound check
                    if (perDay > TimeSeriesForecaster.MAX_KWH_PER_DAY || perDay < 0) {
                        logger.warn("Forecast out of bounds for appliance {}: {} kWh/day, using fallback", 
                                    a.getId(), perDay);
                        perDay = fallback;
                    }
                } catch (Exception e) {
                    logger.warn("Forecast failed for appliance {}, using fallback: {}", a.getId(), e.getMessage());
                    perDay = fallback;
                }
            }

            // Cap at maximum to prevent unrealistic projections
            perDay = Math.min(perDay, TimeSeriesForecaster.MAX_KWH_PER_DAY);

            double baseKwh = perDay * days;
            
            // Apply seasonal adjustment
            double withSeason = baseKwh * season;
            
            // Apply day-of-week adjustment for daily/weekly projections
            if (days <= 7) {
                withSeason *= dowFactor;
            }
            
            // Improved trend calculation with dampening
            double trend = computeImprovedTrendFactor(a.getId(), days);
            
            // Reduced noise for stability
            long seed = Objects.hash(a.getId(), date.toEpochDay());
            double noise = 1 + (new Random(seed).nextDouble() * 2 * NOISE_BOUND - NOISE_BOUND);

            // Final kWh with realistic bounds
            double kwh = Math.min(
                Math.max(withSeason * trend * noise, 0),
                TimeSeriesForecaster.MAX_KWH_PER_DAY * days
            );

            double cost = kwh * rate;
            byApp.put(a.getName(), cost);
            totalKwh += kwh;
            totalCost += cost;

            logger.debug("[ProjectPoint] Appliance: {}, fallback: {}, perDay: {}, season: {}, dow: {}, trend: {}, noise: {}, kwh: {}, cost: {}",
                a.getName(), fallback, perDay, season, dowFactor, trend, noise, kwh, cost);
        }

        logger.debug("[ProjectPoint] Date: {}, Days: {}, Total kWh: {}, Total cost: {}", date, days, totalKwh, totalCost);

        return new UsageProjectionDTO(date.toString(), totalKwh, totalCost, byApp);
    }

    // ————————————————————————————————————————————————————————————————
    // Improved Trend & Daily‐Usage Helpers
    // ————————————————————————————————————————————————————————————————

    /**
     * Day-of-week usage factor based on typical patterns
     */
    private double getDayOfWeekFactor(LocalDate date) {
        DayOfWeek dow = date.getDayOfWeek();
        return switch (dow) {
            case SATURDAY, SUNDAY -> 1.15;  // Weekend higher usage
            case MONDAY, FRIDAY -> 1.05;    // Start/end of week slightly higher
            default -> 1.0;                 // Weekday baseline
        };
    }

    /**
     * Improved trend computation with dampening for long-term projections
     */
    private double computeImprovedTrendFactor(Long applianceId, int projectionDays) {
        LocalDate end   = LocalDate.now().minusDays(1);
        LocalDate start = end.minusDays(MIN_HISTORY_DAYS - 1);
        
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

        if (entries.size() < 4) return 1.0;  // Need minimum data for trend
        
        // Linear regression
        int n = entries.size();
        double sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (int i = 0; i < n; i++) {
            sumX  += i;
            sumY  += entries.get(i).getValue();
            sumXY += i * entries.get(i).getValue();
            sumXX += i * i;
        }
        
        double slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        double meanY = sumY / n;
        
        if (meanY == 0) return 1.0;
        
        // Calculate base trend factor
        double baseTrend = 1 + (slope / meanY);
        
        // Apply dampening for longer projections (trends weaken over time)
        double dampeningFactor = Math.pow(0.95, Math.min(projectionDays, 365) / 30.0);
        double dampenedTrend = 1 + (baseTrend - 1) * dampeningFactor;
        
        // Clamp to reasonable bounds (±15% change)
        return Math.max(0.85, Math.min(1.15, dampenedTrend));
    }

    @Transactional(readOnly = true)
    public double getTotalKwhForDate(Long userId, LocalDate date) {
        return logRepo.findUsageBetween(userId, date, date)
                      .stream()
                      .mapToDouble(EnergyUsageDTO::getkWhUsed)
                      .sum();
    }
}
