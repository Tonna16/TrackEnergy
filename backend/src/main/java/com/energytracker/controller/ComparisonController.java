package com.energytracker.controller;

import com.energytracker.dto.CommunityComparisonDTO;
import com.energytracker.service.ComparisonService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/comparisons")
public class ComparisonController {
    private static final Logger logger = LoggerFactory.getLogger(ComparisonController.class);
    private static final int MIN_HOUSEHOLD_SIZE = 1;
    private static final int MAX_HOUSEHOLD_SIZE = 12;

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    @GetMapping
    public ResponseEntity<?> getCommunityComparison(@RequestParam(defaultValue = "2") int householdSize) {
        if (householdSize < MIN_HOUSEHOLD_SIZE || householdSize > MAX_HOUSEHOLD_SIZE) {
            return ResponseEntity.badRequest().body(Map.of(
                "message", "householdSize must be between " + MIN_HOUSEHOLD_SIZE + " and " + MAX_HOUSEHOLD_SIZE + "."
            ));
        }
        UserDetails userDetails = null;
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                Object principal = auth.getPrincipal();
                if (principal instanceof UserDetails) {
                    userDetails = (UserDetails) principal;
                    logger.debug("ComparisonController: authenticated user={}", userDetails.getUsername());
                } else {
                    logger.debug("ComparisonController: principal is String: {}", principal);
                }
            } else {
                logger.debug("ComparisonController: no authenticated user - serving guest/fallback data.");
            }
        } catch (Exception ex) {
            logger.warn("ComparisonController: error reading authentication: {}", ex.getMessage());
        }

        CommunityComparisonDTO dto = comparisonService.getCommunityComparison(householdSize, userDetails);
        // Frontend expects { householdAvg: number } in many flows — include that
        return ResponseEntity.ok(Map.of(
            "householdAvg", dto.getAverageUsage(),
            "someOtherMetric", dto.getSomeOtherMetric()
        ));
    }
}
