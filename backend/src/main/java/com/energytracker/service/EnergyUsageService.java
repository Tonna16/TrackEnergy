// src/main/java/com/energytracker/service/EnergyUsageService.java
package com.energytracker.service;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageProjectionDTO;
import com.energytracker.dto.UsageSummaryDTO;
import com.energytracker.model.Appliance;
import com.energytracker.model.EnergyUsageLog;
import com.energytracker.model.User;
import com.energytracker.repository.ApplianceRepository;
import com.energytracker.repository.EnergyUsageLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class EnergyUsageService {

    private final EnergyUsageLogRepository logRepo;
    private final ApplianceRepository applianceRepo;
    private final UserSettingsService userSettingsService;
    private final NotificationService notificationService;
    private final UserService userService;

    private static final Map<Integer, Double> SEASONAL_FACTORS = Map.ofEntries(
        Map.entry(0, 0.9),  Map.entry(1, 0.9),  Map.entry(2, 1.0),
        Map.entry(3, 1.0),  Map.entry(4, 1.1),  Map.entry(5, 1.2),
        Map.entry(6, 1.2),  Map.entry(7, 1.2),  Map.entry(8, 1.1),
        Map.entry(9, 1.0),  Map.entry(10, 1.0), Map.entry(11, 0.95)
    );

    public EnergyUsageService(
            EnergyUsageLogRepository logRepo,
            ApplianceRepository applianceRepo,
            UserSettingsService userSettingsService,
            NotificationService notificationService,
            UserService userService
    ) {
        this.logRepo = logRepo;
        this.applianceRepo = applianceRepo;
        this.userSettingsService = userSettingsService;
        this.notificationService = notificationService;
        this.userService = userService;
    }

    @Transactional(readOnly = true)
    public List<EnergyUsageDTO> getUsageDataByUser(Long userId, LocalDate startDate, LocalDate endDate) {
        return logRepo.findUsageByUserId(userId, startDate, endDate);
    }

    @Transactional
    public EnergyUsageLog logUsage(Long applianceId, LocalDate date, double kWhUsed) {
        if (logRepo.findByApplianceIdAndDate(applianceId, date).isPresent()) {
            throw new IllegalArgumentException("Usage already logged for this appliance on this date.");
        }
        EnergyUsageLog entry = new EnergyUsageLog();
        entry.setAppliance(applianceRepo.findById(applianceId)
            .orElseThrow(() -> new IllegalArgumentException("Appliance not found: " + applianceId)));
        entry.setDate(date);
        entry.setKWhUsed(kWhUsed);

        EnergyUsageLog saved = logRepo.save(entry);
        Long userId = entry.getAppliance().getUser().getId();
        checkAndNotifySpike(userId, date);
        return saved;
    }

    private void checkAndNotifySpike(Long userId, LocalDate date) {
        // Build baseline from past 30 days (excluding today)
        LocalDate from = date.minusDays(30), to = date.minusDays(1);
        List<EnergyUsageDTO> past = logRepo.findUsageByUserId(userId, from, to);
        if (past.isEmpty()) return;

        Map<LocalDate, Double> daily = new HashMap<>();
        for (EnergyUsageDTO dto : past) {
            daily.merge(dto.getDate(), dto.getkWhUsed(), Double::sum);
        }
        double avg = daily.values().stream().mapToDouble(d -> d).sum() / daily.size();

        // Today's total
        List<EnergyUsageDTO> todayList = logRepo.findUsageByUserId(userId, date, date);
        double todayTotal = todayList.stream().mapToDouble(EnergyUsageDTO::getkWhUsed).sum();

        if (todayTotal > avg * 1.25 &&
            !notificationService.existsSpikeNotificationForDate(userId, date)) {
            User user = userService.getUserById(userId);
            String title = "Energy Spike Detected";
            String msg = String.format(
              "On %s you used %.2f kWh (25%% above your 30-day average of %.2f kWh).",
              date.format(DateTimeFormatter.ISO_DATE), todayTotal, avg
            );
            notificationService.createAndPush(user, title, "alert", msg);
        }
    }

    @Transactional(readOnly = true)
    public List<UsageProjectionDTO> getProjections(Long userId, String timeRange) {
        List<Appliance> appliances = applianceRepo.findByUserId(userId);
        double rate = userSettingsService.getSettingsByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("Settings not found for user: " + userId))
            .getElectricityRatePerKWh();

        // Compute per-appliance averages
        LocalDate today = LocalDate.now(), pastFrom = today.minusDays(30);
        List<EnergyUsageDTO> past = logRepo.findUsageByUserId(userId, pastFrom, today);
        Map<Long, List<Double>> map = new HashMap<>();
        for (EnergyUsageDTO dto : past) {
            map.computeIfAbsent(dto.getApplianceId(), k -> new ArrayList<>()).add(dto.getkWhUsed());
        }
        Map<Long, Double> avgDaily = new HashMap<>();
        for (Appliance a : appliances) {
            List<Double> vals = map.getOrDefault(a.getId(), List.of());
            if (vals.size() >= 5) {
                avgDaily.put(a.getId(), vals.stream().mapToDouble(v -> v).average().orElse(0));
            } else {
                avgDaily.put(a.getId(), (a.getWattage() * a.getHoursPerDay()) / 1000.0);
            }
        }

        return switch (timeRange.toLowerCase()) {
            case "daily"   -> projectNextNDays(appliances, avgDaily, rate, 30);
            case "weekly"  -> projectNextNWeeks(appliances, avgDaily, rate, 4);
            case "monthly" -> projectNextNMonths(appliances, avgDaily, rate, 6);
            default        -> throw new IllegalArgumentException("Invalid timeRange: " + timeRange);
        };
    }

    private List<UsageProjectionDTO> projectNextNDays(
            List<Appliance> appliances,
            Map<Long, Double> avgDaily,
            double rate,
            int days
    ) {
        List<UsageProjectionDTO> list = new ArrayList<>();
        LocalDate base = LocalDate.now();
        for (int i = 1; i <= days; i++) {
            LocalDate d = base.plusDays(i);
            double season = SEASONAL_FACTORS.getOrDefault(d.getMonthValue() - 1, 1.0);
            double total = 0;
            Map<String, Double> byApp = new LinkedHashMap<>();
            for (Appliance a : appliances) {
                double baseKwh = avgDaily.getOrDefault(a.getId(), 0.0);
                double noise = 1 + (Math.random() * 0.2 - 0.1);
                double kwh = baseKwh * season * noise;
                double cost = kwh * rate;
                byApp.put(a.getName(), cost);
                total += cost;
            }
            list.add(new UsageProjectionDTO(d.format(DateTimeFormatter.ISO_DATE), total, byApp));
        }
        return list;
    }

    private List<UsageProjectionDTO> projectNextNWeeks(
            List<Appliance> appliances,
            Map<Long, Double> avgDaily,
            double rate,
            int weeks
    ) {
        List<UsageProjectionDTO> list = new ArrayList<>();
        LocalDate base = LocalDate.now();
        for (int i = 1; i <= weeks; i++) {
            LocalDate d = base.plusWeeks(i);
            double season = SEASONAL_FACTORS.getOrDefault(d.getMonthValue() - 1, 1.0);
            double total = 0;
            Map<String, Double> byApp = new LinkedHashMap<>();
            for (Appliance a : appliances) {
                double baseKwh = avgDaily.getOrDefault(a.getId(), 0.0) * 7;
                double noise = 1 + (Math.random() * 0.2 - 0.1);
                double kwh = baseKwh * season * noise;
                double cost = kwh * rate;
                byApp.put(a.getName(), cost);
                total += cost;
            }
            list.add(new UsageProjectionDTO(d.format(DateTimeFormatter.ISO_DATE), total, byApp));
        }
        return list;
    }

    private List<UsageProjectionDTO> projectNextNMonths(
            List<Appliance> appliances,
            Map<Long, Double> avgDaily,
            double rate,
            int months
    ) {
        List<UsageProjectionDTO> list = new ArrayList<>();
        LocalDate base = LocalDate.now();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM yyyy");
        for (int i = 1; i <= months; i++) {
            LocalDate d = base.plusMonths(i);
            int daysInMonth = d.lengthOfMonth();
            double season = SEASONAL_FACTORS.getOrDefault(d.getMonthValue() - 1, 1.0);
            double total = 0;
            Map<String, Double> byApp = new LinkedHashMap<>();
            for (Appliance a : appliances) {
                double baseKwh = avgDaily.getOrDefault(a.getId(), 0.0) * daysInMonth;
                double noise = 1 + (Math.random() * 0.2 - 0.1);
                double kwh = baseKwh * season * noise;
                double cost = kwh * rate;
                byApp.put(a.getName(), cost);
                total += cost;
            }
            list.add(new UsageProjectionDTO(d.format(fmt), total, byApp));
        }
        return list;
    }

    public UsageSummaryDTO getUsageSummary(Long userId) {
        List<EnergyUsageLog> entries = logRepo.findAllByUserId(userId);
        double totalKwh = 0, totalCost = 0;
        Map<LocalDate, Double> perDay = new TreeMap<>();
        double rate = userSettingsService.getSettingsByUserId(userId)
            .orElseThrow(() -> new IllegalArgumentException("Settings not found for user: " + userId))
            .getElectricityRatePerKWh();

        for (EnergyUsageLog e : entries) {
            double k = e.getKWhUsed();
            totalKwh += k;
            totalCost += k * rate;
            perDay.merge(e.getDate(), k, Double::sum);
        }
        double avg = perDay.isEmpty() ? 0 : totalKwh / perDay.size();
        return new UsageSummaryDTO(totalKwh, totalCost, avg);
    }
}
