package com.energytracker.service;

import java.util.List;

import com.energytracker.dto.CommunityComparisonDTO;
import com.energytracker.dto.UsageStats;
import com.energytracker.repository.EnergyUsageLogRepository;
import com.energytracker.security.CustomUserDetails;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

@Service
public class ComparisonService {
    private static final Logger logger = LoggerFactory.getLogger(ComparisonService.class);

    private final EnergyUsageLogRepository usageRepository;
    private final EIAService eiaService;

    public ComparisonService(EnergyUsageLogRepository usageRepository, EIAService eiaService) {
        this.usageRepository = usageRepository;
        this.eiaService = eiaService;
    }

    /**
     * Return a CommunityComparisonDTO for the requested household size or the authenticated user's household size.
     */
    public CommunityComparisonDTO getCommunityComparison(Integer requestedHouseholdSize, UserDetails user) {
        Integer householdSize = requestedHouseholdSize;

        if (user instanceof CustomUserDetails customUser) {
            try {
                Integer userSize = customUser.getUser() == null ? null : customUser.getUser().getHouseholdSize();
                if (userSize != null && userSize >= 1) {
                    householdSize = userSize;
                }
            } catch (Exception ex) {
                logger.debug("[ComparisonService] could not read household size from user details: {}", ex.getMessage());
            }
        }

        if (householdSize == null || householdSize < 1) householdSize = 2;
        int normalized = householdSize >= 5 ? 5 : householdSize;
        logger.debug("[ComparisonService] using household size {} (normalized {})", householdSize, normalized);

        List<UsageStats> communityStats = null;
        try {
            communityStats = usageRepository.findCommunityStatsByHouseholdSize(normalized);
        } catch (Exception ex) {
            logger.warn("[ComparisonService] error querying community stats: {}", ex.getMessage());
            communityStats = null;
        }

        // If DB returned any rows, average them and use that
        if (communityStats != null && !communityStats.isEmpty()) {
            double avgUsage = communityStats.stream()
                                           .mapToDouble(UsageStats::getTotalKwh)
                                           .average()
                                           .orElse(0.0);
            logger.info("[ComparisonService] using local DB avgUsage={} kWh/day (householdSize={})", avgUsage, normalized);
            return new CommunityComparisonDTO(avgUsage, 0.0);
        }

        // No DB results -> fall back to EIA
        double avgUsage = eiaService.getNationalAverageUsage(normalized).orElse(13.7);
        logger.info("[ComparisonService] no local data; using EIA fallback avgUsage={} kWh/day for householdSize={}", avgUsage, normalized);
        return new CommunityComparisonDTO(avgUsage, 0.0);
    }
}
