package com.energytracker.service;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.HistoryForecastDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.UserSettings;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.SecurityUtils;
import com.util.TimeSeriesForecaster;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
public class EnergyUsageService {
    public static final int REQUIRED_HISTORY_DAYS = 60;

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private final UserSettingsService userSettingsService;
    private final TimeSeriesForecaster forecaster;
    private final UserService userService;
    private final NotificationService notificationService;
    private final EnergyCalculationService calculations;
    private final Clock clock;

    @Autowired
    public EnergyUsageService(
        EnergyUsageLogRepository logRepo,
        ApplianceRepository applianceRepo,
        UserSettingsService userSettingsService,
        TimeSeriesForecaster forecaster,
        UserService userService,
        NotificationService notificationService,
        EnergyCalculationService calculations,
        Clock clock
    ) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
        this.userSettingsService = userSettingsService;
        this.forecaster = forecaster;
        this.userService = userService;
        this.notificationService = notificationService;
        this.calculations = calculations;
        this.clock = clock;
    }

    /** Backward-compatible constructor retained for focused unit tests. */
    public EnergyUsageService(
        EnergyUsageLogRepository logRepo,
        ApplianceRepository applianceRepo,
        UserSettingsService userSettingsService,
        TimeSeriesForecaster forecaster,
        UserService userService,
        NotificationService notificationService
    ) {
        this(
            logRepo,
            applianceRepo,
            userSettingsService,
            forecaster,
            userService,
            notificationService,
            new EnergyCalculationService(new EnergyDomainConfig()),
            Clock.systemDefaultZone()
        );
    }

    public List<Appliance> getAppliances(Long userId) {
        return applianceRepo.findAllByUserIdAndActiveTrueAndDeletedFalse(userId);
    }

    private double getRate(Long userId) {
        if (userId == null) return calculations.defaultElectricityRate();
        return userSettingsService.getSettingsByUserId(userId)
            .map(UserSettings::getElectricityRatePerKWh)
            .filter(rate -> Double.isFinite(rate) && rate >= 0)
            .orElse(calculations.defaultElectricityRate());
    }

    private String getCurrency(Long userId) {
        if (userId == null) return calculations.defaultCurrency();
        return userSettingsService.getSettingsByUserId(userId)
            .map(UserSettings::getCurrency)
            .map(calculations::normalizeCurrency)
            .orElse(calculations.defaultCurrency());
    }

    public double getAverageRate(Long userId) { return getRate(userId); }
    public Double getFallbackEstimate() { return 0.0; }
    public Double getFallbackDailyCost() { return 0.0; }
    public double getDefaultElectricityRate() { return calculations.defaultElectricityRate(); }
    public String getDefaultCurrency() { return calculations.defaultCurrency(); }

    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getUsageDataByUser(Long userId, LocalDate start, LocalDate end) {
        if (userId == null) return Collections.emptyList();
        if (start == null && end == null) return logRepo.findUsageAll(userId);
        LocalDate resolvedEnd = end == null ? LocalDate.now(clock) : end;
        LocalDate resolvedStart = start == null ? resolvedEnd.minusDays(29) : start;
        return logRepo.findUsageBetween(userId, resolvedStart, resolvedEnd);
    }

    public List<EnergyUsageDTO> getFallbackUsageData(LocalDate start, LocalDate end) {
        return Collections.emptyList();
    }

    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummary(Long userId) {
        if (userId == null) return UsageSummaryDTO.empty(calculations.defaultCurrency());
        return summaryFromAggregates(userId, logRepo.summarizeUsageByUserId(userId));
    }

    public UsageSummaryDTO getFallbackUsageSummary(Integer days) {
        return UsageSummaryDTO.empty(calculations.defaultCurrency());
    }

    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummaryForRange(Long userId, int days) {
        if (userId == null) return UsageSummaryDTO.empty(calculations.defaultCurrency());
        LocalDate end = LocalDate.now(clock);
        LocalDate start = end.minusDays(days - 1L);
        return summaryFromAggregates(userId, logRepo.summarizeUsageByUserIdAndDateBetween(userId, start, end));
    }

    private UsageSummaryDTO summaryFromAggregates(Long userId, Object[] aggregates) {
        Object[] row = unwrapAggregateRow(aggregates);
        double totalKwh = safeDouble(row, 0);
        long distinctDays = safeLong(row, 1);
        double averageDailyKwh = distinctDays == 0 ? 0.0 : totalKwh / distinctDays;
        return new UsageSummaryDTO(
            totalKwh,
            calculations.cost(totalKwh, getRate(userId)),
            averageDailyKwh,
            calculations.estimatedCarbonKg(totalKwh),
            getCurrency(userId)
        );
    }

    /**
     * Hibernate returns a single multi-column aggregate either as the row itself
     * or as a one-element outer array containing that row, depending on the
     * repository execution path. Normalize both representations so the public
     * summary contract is stable in H2 and in focused repository mocks.
     */
    private Object[] unwrapAggregateRow(Object[] aggregates) {
        if (aggregates != null
            && aggregates.length == 1
            && aggregates[0] instanceof Object[] nested) {
            return nested;
        }
        return aggregates;
    }

    private double safeDouble(Object[] aggregates, int index) {
        return aggregates != null && aggregates.length > index && aggregates[index] instanceof Number value
            ? value.doubleValue()
            : 0.0;
    }

    private long safeLong(Object[] aggregates, int index) {
        return aggregates != null && aggregates.length > index && aggregates[index] instanceof Number value
            ? value.longValue()
            : 0L;
    }

    @Transactional(readOnly = true)
    public List<UsageProjectionDTO> getProjections(Long userId, String timeRange) {
        return formulaProjections(getAppliances(userId), getRate(userId), getCurrency(userId), timeRange);
    }

    private List<UsageProjectionDTO> formulaProjections(
        List<Appliance> appliances,
        double rate,
        String currency,
        String timeRange
    ) {
        return switch (timeRange.toLowerCase()) {
            case "daily" -> project(appliances, rate, 1, 30, false, "yyyy-MM-dd", currency);
            case "weekly" -> project(appliances, rate, 7, 4, false, "yyyy-MM-dd", currency);
            case "monthly" -> project(appliances, rate, -1, 6, false, "yyyy-MM-dd", currency);
            default -> throw new IllegalArgumentException("Invalid timeRange");
        };
    }

    @Transactional(readOnly = true)
    public Double getAnnualCostForecast(Long userId) {
        return project(getAppliances(userId), getRate(userId), -1, 12, false, "yyyy-MM-dd", getCurrency(userId))
            .stream()
            .mapToDouble(UsageProjectionDTO::getTotalCost)
            .sum();
    }

    @Transactional(readOnly = true)
    public Double getForecastedDailyCost(Long userId) {
        List<UsageProjectionDTO> projection = getProjections(userId, "daily");
        return projection.isEmpty() ? 0.0 : projection.get(0).getTotalCost();
    }

    @Transactional(readOnly = true)
    public HistoryForecastDTO getHistoryForecast(Long userId, String timeRange) {
        List<Appliance> appliances = getAppliances(userId);
        LocalDate end = LocalDate.now(clock).minusDays(1);
        LocalDate coverageStart = end.minusDays(89);
        LocalDate trainingStart = end.minusDays(REQUIRED_HISTORY_DAYS - 1L);
        long historyDays = appliances.isEmpty() ? 0L : 90L;
        long recentHistoryDays = appliances.isEmpty() ? 0L : REQUIRED_HISTORY_DAYS;
        for (Appliance appliance : appliances) {
            List<LocalDate> dates = logRepo.findByApplianceIdAndDateBetween(appliance.getId(), coverageStart, end)
                .stream()
                .filter(entry -> entry.getDate() != null && !entry.getDate().isBefore(coverageStart)
                    && !entry.getDate().isAfter(end) && Double.isFinite(entry.getKWhUsed()) && entry.getKWhUsed() >= 0)
                .map(EnergyUsageLog::getDate).distinct().toList();
            historyDays = Math.min(historyDays, dates.size());
            recentHistoryDays = Math.min(recentHistoryDays,
                dates.stream().filter(date -> !date.isBefore(trainingStart)).count());
        }
        String dataCoverage = historyDays + "/90 completed days recorded; " + recentHistoryDays
            + "/60 in the latest training window";

        if (appliances.isEmpty() || recentHistoryDays < REQUIRED_HISTORY_DAYS) {
            return new HistoryForecastDTO(
                "insufficient_history",
                dataCoverage,
                historyDays,
                recentHistoryDays,
                REQUIRED_HISTORY_DAYS,
                "History-Based Forecast requires an observation on each of the latest 60 completed days for every active appliance. Showing Formula Projection instead.",
                Collections.emptyList()
            );
        }

        List<ProjectionInterval> intervals = projectionIntervals(timeRange);
        LocalDate forecastStart = LocalDate.now(clock).plusDays(1);
        LocalDate finalDate = intervals.get(intervals.size() - 1).end();
        int horizon = Math.toIntExact(ChronoUnit.DAYS.between(forecastStart, finalDate) + 1);
        Map<Long, List<Double>> forecasts = new LinkedHashMap<>();
        for (Appliance appliance : appliances) {
            forecasts.put(appliance.getId(), forecaster.forecastNextNDays(appliance.getId(), horizon));
        }

        double rate = getRate(userId);
        String currency = getCurrency(userId);
        List<UsageProjectionDTO> projections = new ArrayList<>();
        for (ProjectionInterval interval : intervals) {
            int startIndex = Math.toIntExact(ChronoUnit.DAYS.between(forecastStart, interval.start()));
            int periodDays = Math.toIntExact(ChronoUnit.DAYS.between(interval.start(), interval.end()) + 1);
            Map<String, Double> byAppKwh = new LinkedHashMap<>();
            Map<String, Double> byAppCost = new LinkedHashMap<>();
            double totalKwh = 0.0;
            for (Appliance appliance : appliances) {
                List<Double> dailyForecast = forecasts.get(appliance.getId());
                double applianceKwh = 0.0;
                for (int offset = 0; offset < periodDays; offset++) {
                    int index = startIndex + offset;
                    if (index >= 0 && index < dailyForecast.size()) {
                        applianceKwh += Math.max(0.0, dailyForecast.get(index));
                    }
                }
                byAppKwh.merge(appliance.getName(), applianceKwh, Double::sum);
                byAppCost.merge(appliance.getName(), calculations.cost(applianceKwh, rate), Double::sum);
                totalKwh += applianceKwh;
            }
            projections.add(toProjection(interval, totalKwh, rate, currency, byAppKwh, byAppCost, "history-based"));
        }

        return new HistoryForecastDTO(
            "available",
            dataCoverage,
            historyDays,
            recentHistoryDays,
            REQUIRED_HISTORY_DAYS,
            "Deterministic Holt/Holt-Winters forecast from the latest 60 completed days. Data coverage describes observations, not forecast accuracy.",
            projections
        );
    }

    private List<ProjectionInterval> projectionIntervals(String timeRange) {
        LocalDate today = LocalDate.now(clock);
        List<ProjectionInterval> intervals = new ArrayList<>();
        switch (timeRange.toLowerCase()) {
            case "daily" -> {
                for (int index = 1; index <= 30; index++) {
                    LocalDate date = today.plusDays(index);
                    intervals.add(new ProjectionInterval(date, date, false));
                }
            }
            case "weekly" -> {
                LocalDate firstMonday = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY));
                for (int index = 0; index < 4; index++) {
                    LocalDate start = firstMonday.plusWeeks(index);
                    intervals.add(new ProjectionInterval(start, start.plusDays(6), true));
                }
            }
            case "monthly" -> {
                YearMonth firstMonth = YearMonth.from(today).plusMonths(1);
                for (int index = 0; index < 6; index++) {
                    YearMonth month = firstMonth.plusMonths(index);
                    intervals.add(new ProjectionInterval(month.atDay(1), month.atEndOfMonth(), false));
                }
            }
            default -> throw new IllegalArgumentException("Invalid timeRange");
        }
        return intervals;
    }

    public List<UsageProjectionDTO> project(
        List<Appliance> appliances,
        double rate,
        int periodDays,
        int count,
        boolean useForecast,
        String datePattern
    ) {
        return project(appliances, rate, periodDays, count, useForecast, datePattern, calculations.defaultCurrency());
    }

    private List<UsageProjectionDTO> project(
        List<Appliance> appliances,
        double rate,
        int periodDays,
        int count,
        boolean useForecast,
        String datePattern,
        String currency
    ) {
        LocalDate today = LocalDate.now(clock);
        List<UsageProjectionDTO> output = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            ProjectionInterval interval;
            if (periodDays == 7) {
                LocalDate start = today.with(TemporalAdjusters.next(DayOfWeek.MONDAY)).plusWeeks(index);
                interval = new ProjectionInterval(start, start.plusDays(6), true);
            } else if (periodDays < 0) {
                YearMonth month = YearMonth.from(today).plusMonths(index + 1L);
                interval = new ProjectionInterval(month.atDay(1), month.atEndOfMonth(), false);
            } else {
                LocalDate start = today.plusDays((long) index * periodDays + 1);
                interval = new ProjectionInterval(start, start.plusDays(periodDays - 1L), false);
            }
            output.add(formulaPoint(appliances, interval, rate, currency));
        }
        return output;
    }

    public UsageProjectionDTO projectPoint(
        List<Appliance> appliances,
        LocalDate date,
        int days,
        boolean useForecast,
        double rate
    ) {
        ProjectionInterval interval = new ProjectionInterval(date, date.plusDays(days - 1L), days == 7);
        return formulaPoint(appliances, interval, rate, calculations.defaultCurrency());
    }

    private UsageProjectionDTO formulaPoint(
        List<Appliance> appliances,
        ProjectionInterval interval,
        double rate,
        String currency
    ) {
        int days = Math.toIntExact(ChronoUnit.DAYS.between(interval.start(), interval.end()) + 1);
        Map<String, Double> byAppKwh = new LinkedHashMap<>();
        Map<String, Double> byAppCost = new LinkedHashMap<>();
        double totalKwh = 0.0;
        for (Appliance appliance : appliances) {
            if (!calculations.included(appliance)) continue;
            double kwh = calculations.dailyKwh(appliance) * days;
            byAppKwh.merge(appliance.getName(), kwh, Double::sum);
            byAppCost.merge(appliance.getName(), calculations.cost(kwh, rate), Double::sum);
            totalKwh += kwh;
        }
        return toProjection(interval, totalKwh, rate, currency, byAppKwh, byAppCost, "formula-estimate");
    }

    private UsageProjectionDTO toProjection(
        ProjectionInterval interval,
        double totalKwh,
        double rate,
        String currency,
        Map<String, Double> byAppKwh,
        Map<String, Double> byAppCost,
        String source
    ) {
        int days = Math.toIntExact(ChronoUnit.DAYS.between(interval.start(), interval.end()) + 1);
        return new UsageProjectionDTO(
            interval.start().toString(),
            interval.weekly() ? interval.start().toString() : null,
            interval.weekly() ? interval.end().toString() : null,
            days,
            totalKwh,
            calculations.cost(totalKwh, rate),
            calculations.estimatedCarbonKg(totalKwh),
            byAppKwh,
            byAppCost,
            calculations.normalizeCurrency(currency),
            source
        );
    }

    private Long getAuthenticatedUserId() {
        return SecurityUtils.getAuthenticatedUser().getId();
    }

    @Transactional
    public EnergyUsageLog logUsage(Long applianceId, LocalDate date, double kWhUsed) {
        if (!Double.isFinite(kWhUsed) || kWhUsed < 0) {
            throw new IllegalArgumentException("kWhUsed must be a non-negative number");
        }
        Long authenticatedUserId = getAuthenticatedUserId();
        if (!applianceRepo.existsByIdAndUserId(applianceId, authenticatedUserId)) {
            if (applianceRepo.existsById(applianceId)) {
                throw new AccessDeniedException("Appliance is not owned by the authenticated user");
            }
            throw new NoSuchElementException("Appliance not found");
        }
        Appliance appliance = applianceRepo.findByIdAndUserIdAndActiveTrueAndDeletedFalse(applianceId, authenticatedUserId)
            .orElseThrow(() -> new NoSuchElementException("Appliance not found"));
        if (logRepo.findByApplianceIdAndDate(applianceId, date).isPresent()) {
            throw new IllegalArgumentException("Usage already logged on " + date);
        }

        EnergyUsageLog entry = new EnergyUsageLog();
        entry.setAppliance(appliance);
        entry.setDate(date);
        entry.setKWhUsed(kWhUsed);
        EnergyUsageLog saved = logRepo.save(entry);

        if (appliance.getUser() != null && kWhUsed > calculations.dailyKwh(appliance) * 1.2) {
            var user = userService.getUserById(appliance.getUser().getId());
            notificationService.createHighUsageNotificationIfNotExists(
                user, applianceId, appliance.getName(), date, kWhUsed
            );
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public double getTotalKwhForDate(Long userId, LocalDate date) {
        return logRepo.findUsageBetween(userId, date, date).stream().mapToDouble(EnergyUsageDTO::getkWhUsed).sum();
    }

    private record ProjectionInterval(LocalDate start, LocalDate end, boolean weekly) {}
}
