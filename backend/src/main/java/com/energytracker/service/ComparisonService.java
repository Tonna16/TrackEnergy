package com.energytracker.service;

import com.energytracker.dto.CommunityComparisonDTO;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.security.CustomUserDetails;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ComparisonService {
    private static final Map<Integer, Double> SAMPLE_DAILY_KWH = Map.of(
        1, 20.0,
        2, 21.0,
        3, 25.0,
        4, 28.0,
        5, 32.0
    );

    private final EnergyUsageLogRepository usageRepository;

    public ComparisonService(EnergyUsageLogRepository usageRepository) {
        this.usageRepository = usageRepository;
    }

    public CommunityComparisonDTO getCommunityComparison(Integer requestedHouseholdSize, UserDetails user) {
        Integer householdSize = requestedHouseholdSize;
        if (user instanceof CustomUserDetails customUser && customUser.getUser() != null
            && customUser.getUser().getHouseholdSize() != null) {
            householdSize = customUser.getUser().getHouseholdSize();
        }
        int normalized = householdSize == null || householdSize < 1 ? 2 : Math.min(5, householdSize);
        Double databaseAverage;
        try {
            databaseAverage = usageRepository.findCommunityDailyAverageByHouseholdSize(normalized);
        } catch (RuntimeException ignored) {
            databaseAverage = null;
        }
        if (databaseAverage != null && databaseAverage > 0) {
            return new CommunityComparisonDTO(databaseAverage, "local-database", false);
        }
        return new CommunityComparisonDTO(SAMPLE_DAILY_KWH.get(normalized), "sample", true);
    }
}
