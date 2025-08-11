package com.energytracker.service;

import java.util.List;
import java.util.Optional;

import com.energytracker.dto.CommunityComparisonDTO;
import com.energytracker.dto.UsageStats;
import com.energytracker.repository.EnergyUsageLogRepository;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

@Service
public class ComparisonService {

    private final EnergyUsageLogRepository usageRepository;
    private final EIAService eiaService;

    public ComparisonService(EnergyUsageLogRepository usageRepository, EIAService eiaService) {
        this.usageRepository = usageRepository;
        this.eiaService = eiaService;
    }

    public CommunityComparisonDTO getCommunityComparison(int householdSize, UserDetails user) {
        List<UsageStats> communityStats = usageRepository.findCommunityStats(householdSize);

        if (communityStats.size() < 5) {
            Optional<Double> eiaAvgOpt = eiaService.getNationalAverageUsage();
            double avgUsage = eiaAvgOpt.orElse(300.0);  // fixed here
            return new CommunityComparisonDTO(avgUsage, 0.0);
        }

        double avgUsage = communityStats.stream()
                                        .mapToDouble(UsageStats::getTotalKwh)
                                        .average()
                                        .orElse(0);

        return new CommunityComparisonDTO(avgUsage, 0.0);
    }
}
