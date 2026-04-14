package com.energytracker.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final List<String> allowedOrigins;

    public SecurityConfig(
        JwtUtil jwtUtil,
        @Value("${app.cors.allowed-origins:http://localhost:5173}") String allowedOriginsConfig
    ) {
        this.jwtUtil = jwtUtil;
        this.allowedOrigins = Arrays.stream(allowedOriginsConfig.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .collect(Collectors.toList());
    }

    @Bean
    public JwtAuthFilter jwtAuthFilter() {
        return new JwtAuthFilter(jwtUtil);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                // Publicly accessible endpoints
                .requestMatchers("/api/auth/**", "/api/tips/**", "/ws/**")
                    .permitAll()
                // Operational/docs endpoints (if enabled)
                .requestMatchers("/actuator/health", "/actuator/health/**", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                // Guest-safe read/fallback endpoints
                .requestMatchers(HttpMethod.POST, "/api/energy-usage/projections")
                    .permitAll()
                .requestMatchers(
                    "/api/energy-usage/summary",
                    "/api/energy-usage/annual-cost",
                    "/api/energy-usage/forecasted-daily-cost",
                    "/api/comparisons",
                    "/api/comparisons/**"
                )
                    .permitAll()
                // Role-scoped API endpoints
                .requestMatchers("/api/forecast/**")
                    .hasRole("USER")
                // Authenticated API endpoints
                .requestMatchers("/api/energy-usage/**", "/api/notifications/**", "/api/appliances/**", "/api/settings/**", "/api/profile")
                    .authenticated()
                .requestMatchers(HttpMethod.GET, "/api/appliances")
                    .authenticated()
                // Deny everything else by default
                .anyRequest()
                    .denyAll()
            )
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class)
            .httpBasic(httpBasic -> httpBasic.disable());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(allowedOrigins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin"));
        cfg.setExposedHeaders(List.of("Authorization"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}
