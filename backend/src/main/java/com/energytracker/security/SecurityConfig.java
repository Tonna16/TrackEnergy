package com.energytracker.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtUtil jwtUtil;

    public SecurityConfig(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
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
            // public
            .requestMatchers(HttpMethod.GET, "/api/energy-usage/**").permitAll()
            .requestMatchers("/api/auth/**", "/api/appliances/**", "/api/annual-cost", "/api/forecasted-daily-cost",
                             "/api/exchange-rate", "/api/currency/**", "/api/tips/**", "/ws/**")
               .permitAll()
          
            // secure energy endpoints
            .requestMatchers(HttpMethod.POST, "/api/energy-usage").authenticated()
            .requestMatchers(HttpMethod.PUT, "/api/energy-usage/**").authenticated()
            .requestMatchers(HttpMethod.DELETE, "/api/energy-usage/**").authenticated()
          
            // **Protect all notifications endpoints**
            .requestMatchers("/api/notifications/**").authenticated()
          
            // forecast endpoints
            .requestMatchers("/api/forecast/**").hasRole("USER")
          
            // all routes not listed above
            .anyRequest().authenticated()
          )
          
            .addFilterBefore(jwtAuthFilter(), UsernamePasswordAuthenticationFilter.class)
            .httpBasic(httpBasic -> httpBasic.disable());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("http://localhost:5173")); // Change for prod
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }
}
