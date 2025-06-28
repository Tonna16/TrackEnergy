// src/main/java/com/energytracker/service/EnergyUsageService.java
package com.energytracker.service;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.util.TimeSeriesForecaster;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EnergyUsageService {

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private final UserSettingsService userSettingsService;
    private final TimeSeriesForecaster forecaster;

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
        TimeSeriesForecaster forecaster
    ) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
        this.userSettingsService = userSettingsService;
        this.forecaster = forecaster;
    }

    /** Raw usage data for charts */
    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getUsageDataByUser(Long userId, LocalDate start, LocalDate end) {
        return logRepo.findUsageBetween(userId, start, end);
    }

    /** Full-history summary */
    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummary(Long userId) {
        var entries = logRepo.findAllByUserId(userId);
        double rate = userSettingsService
            .getSettingsByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("Settings missing"))
            .getElectricityRatePerKWh();

        double totalKwh = 0, totalCost = 0;
        Set<LocalDate> dates = new HashSet<>();
        for (var e : entries) {
            totalKwh += e.getKWhUsed();
            totalCost += e.getKWhUsed() * rate;
            dates.add(e.getDate());
        }
        double avgDaily = dates.isEmpty() ? 0 : totalKwh / dates.size();
        return new UsageSummaryDTO(totalKwh, totalCost, avgDaily);
    }

    /** Last-N-days summary */
    @Transactional(readOnly = true)
    public UsageSummaryDTO getUsageSummaryForRange(Long userId, int days) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1);
        var entries = logRepo.findAllByUserId(userId).stream()
            .filter(e -> !e.getDate().isBefore(start) && !e.getDate().isAfter(end))
            .collect(Collectors.toList());

        double rate = userSettingsService
            .getSettingsByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("Settings missing"))
            .getElectricityRatePerKWh();

        Map<LocalDate, Double> dailySum = new HashMap<>();
        for (var e : entries) {
            dailySum.merge(e.getDate(), e.getKWhUsed(), Double::sum);
        }

        double totalKwh = dailySum.values().stream().mapToDouble(Double::doubleValue).sum();
        double avgDaily = dailySum.isEmpty() ? 0 : totalKwh / dailySum.size();
        double totalCost = totalKwh * rate;
        return new UsageSummaryDTO(totalKwh, totalCost, avgDaily);
    }

    /** Annual cost forecast by summing 12 monthly projections */
    @Transactional(readOnly = true)
    public double getAnnualCostForecast(Long userId) {
        var apps = applianceRepo.findByUserId(userId);
        double rate = userSettingsService
            .getSettingsByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("Settings missing"))
            .getElectricityRatePerKWh();

        long historyDays = logRepo.findAllByUserId(userId).stream()
                                  .map(EnergyUsageLog::getDate)
                                  .distinct().count();
        boolean useForecast = historyDays >= MIN_HISTORY_DAYS;

        var monthly = project(apps, rate, -1, 12, useForecast, "MMM yyyy");
        return monthly.stream().mapToDouble(UsageProjectionDTO::getTotalCost).sum();
    }

    /** Manual entry */
    @Transactional
    public EnergyUsageLog logUsage(Long applianceId, LocalDate date, double kWhUsed) {
        if (logRepo.findByApplianceIdAndDate(applianceId, date).isPresent()) {
            throw new IllegalArgumentException("Usage already logged on " + date);
        }
        var entry = new EnergyUsageLog();
        var app = applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found"));
        entry.setAppliance(app);
        entry.setDate(date);
        entry.setKWhUsed(kWhUsed);
        return logRepo.save(entry);
    }

    /** Cost projections (daily/weekly/monthly) */
    @Transactional(readOnly = true)
    public List<UsageProjectionDTO> getProjections(Long userId, String timeRange) {
        var apps = applianceRepo.findByUserId(userId);
        double rate = userSettingsService
            .getSettingsByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("Settings missing"))
            .getElectricityRatePerKWh();

        long historyDays = logRepo.findAllByUserId(userId).stream()
                                  .map(EnergyUsageLog::getDate)
                                  .distinct().count();
        boolean useForecast = historyDays >= MIN_HISTORY_DAYS;

        return switch (timeRange.trim().toLowerCase()) {
            case "daily"   -> project(apps, rate, 1, 30, useForecast, "yyyy-MM-dd");
            case "weekly"  -> project(apps, rate, 7,  4, useForecast, "yyyy-MM-dd");
            case "monthly" -> project(apps, rate, -1, 6, useForecast, "MMM yyyy");
            default        -> throw new IllegalArgumentException("Invalid timeRange");
        };
    }

    /** Helper to build the projections list */
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

    /** Core projection logic per date */
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

            double kwh  = withSeason * trend * noise;
            double cost = kwh * rate;
            byApp.put(a.getName(), cost);
            totalCost += cost;
        }
        return new UsageProjectionDTO(date.toString(), totalCost, byApp);
    }

    /** Helper to compute a simple linear trend factor */
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
        int n = entries.size(), i=0;
        double sumX=0, sumY=0, sumXY=0, sumXX=0;
        for (var e : entries) {
            sumX  += i;
            sumY  += e.getValue();
            sumXY += i * e.getValue();
            sumXX += i * i;
            i++;
        }
        double slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        double meanY = sumY / n;
        return (meanY == 0) ? 1.0 : Math.max(0.9, Math.min(1.1, 1 + slope/meanY));
    }

    /** Sum of kWh for a specific day */
    @Transactional(readOnly = true)
    public double getTotalKwhForDate(Long userId, LocalDate date) {
        return logRepo.findUsageBetween(userId, date, date).stream()
                      .mapToDouble(EnergyUsageDTO::getkWhUsed)
                      .sum();
    }
}
