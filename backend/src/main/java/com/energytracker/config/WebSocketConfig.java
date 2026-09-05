package com.energytracker.config;

import com.energytracker.security.JwtHandshakeInterceptor;
import com.energytracker.security.JwtUtil;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtil jwtUtil;
    private final CorsOriginConfiguration corsOrigins;

    public WebSocketConfig(JwtUtil jwtUtil, CorsOriginConfiguration corsOrigins) {
        this.jwtUtil = jwtUtil;
        this.corsOrigins = corsOrigins;
    }

    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry
            .addEndpoint("/ws")
            .addInterceptors(new JwtHandshakeInterceptor(jwtUtil), new HttpSessionHandshakeInterceptor())
            .setAllowedOriginPatterns(corsOrigins.allowedOrigins().toArray(String[]::new))
            .withSockJS();
    }
}
