package com.energytracker.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * Provides the configured browser origins to both HTTP CORS and WebSocket setup.
 */
@Component
public class CorsOriginConfiguration {

    private final List<String> allowedOrigins;

    public CorsOriginConfiguration(
        @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOriginsConfig
    ) {
        this.allowedOrigins = Arrays.stream(allowedOriginsConfig.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .distinct()
            .toList();
    }

    public List<String> allowedOrigins() {
        return allowedOrigins;
    }
}
