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

/**
 * Exposes community comparison endpoints used by the frontend.
 *
 * Frontend expects: GET /api/comparisons?householdSize=2
 */
@RestController
@RequestMapping("/api/comparisons")
public class ComparisonController {
    private static final Logger logger = LoggerFactory.getLogger(ComparisonController.class);

    private final ComparisonService comparisonService;

    public ComparisonController(ComparisonService comparisonService) {
        this.comparisonService = comparisonService;
    }

    /**
     * Return community comparison data for a given household size.
     * If the user is authenticated, their identity is passed to the service; otherwise null is passed.
     *
     * Example:
     *   GET /api/comparisons?householdSize=2
     */
    @GetMapping
    public ResponseEntity<?> getCommunityComparison(@RequestParam(defaultValue = "2") int householdSize) {
        // Try to extract UserDetails from the SecurityContext if the user is authenticated.
        UserDetails userDetails = null;
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                Object principal = auth.getPrincipal();
                if (principal instanceof UserDetails) {
                    userDetails = (UserDetails) principal;
                    logger.debug("ComparisonController: authenticated user={}", userDetails.getUsername());
                } else if (principal instanceof String) {
                    // Principal might be a String username depending on your JwtAuthFilter; service can handle null or adapt.
                    logger.debug("ComparisonController: principal is String: {}", principal);
                }
            } else {
                logger.debug("ComparisonController: no authenticated user - serving guest/fallback data.");
            }
        } catch (Exception ex) {
            logger.warn("ComparisonController: error reading authentication: {}", ex.getMessage());
            // continue with userDetails == null
        }

        // Delegate to service (it will return EIA fallback when community data is insufficient)
        CommunityComparisonDTO dto = comparisonService.getCommunityComparison(householdSize, userDetails);
        return ResponseEntity.ok(dto);
    }
}
