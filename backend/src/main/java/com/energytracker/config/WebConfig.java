// src/main/java/com/energytracker/config/WebConfig.java
package com.energytracker.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("http://localhost:5173")
                .allowedMethods("*")
                .allowCredentials(true);

        // Also allow the SockJS endpoint
        registry.addMapping("/ws/**")
                .allowedOriginPatterns("http://localhost:5173")
                .allowedMethods("*")
                .allowCredentials(true);
    }
}
