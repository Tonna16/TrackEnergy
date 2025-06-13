// src/main/java/com/energytracker/security/SecurityConfig.java
package com.energytracker.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtFilter;

    public SecurityConfig(JwtAuthFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
          .csrf(csrf -> csrf.disable())
          .cors(Customizer.withDefaults())
          .authorizeHttpRequests(auth -> auth
              // Public endpoints
              .requestMatchers("/api/auth/**").permitAll()
              .requestMatchers("/api/tips/**").permitAll()
              .requestMatchers("/ws/**").permitAll()             // SockJS handshake
              // Secured endpoints
              .requestMatchers("/api/notifications/**").authenticated()
              .requestMatchers("/api/energy-usage/**").authenticated()
              .anyRequest().authenticated()
          )
          .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
          .httpBasic(basic -> basic.disable());

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // allow your frontend origin (with credentials)
        cfg.setAllowedOriginPatterns(List.of("http://localhost:5173"));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config
    ) throws Exception {
        return config.getAuthenticationManager();
    }
}
