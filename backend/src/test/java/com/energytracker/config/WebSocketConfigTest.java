package com.energytracker.config;

import com.energytracker.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.config.annotation.SockJsServiceRegistration;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;
import org.springframework.web.socket.server.HandshakeInterceptor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebSocketConfigTest {

    @Test
    void websocketUsesTrimmedConfiguredOrigins() {
        JwtUtil jwtUtil = mock(JwtUtil.class);
        StompEndpointRegistry registry = mock(StompEndpointRegistry.class);
        StompWebSocketEndpointRegistration registration = mock(StompWebSocketEndpointRegistration.class);
        SockJsServiceRegistration sockJsRegistration = mock(SockJsServiceRegistration.class);

        when(registry.addEndpoint("/ws")).thenReturn(registration);
        when(registration.addInterceptors(any(HandshakeInterceptor[].class))).thenReturn(registration);
        when(registration.setAllowedOriginPatterns(any(String[].class))).thenReturn(registration);
        when(registration.withSockJS()).thenReturn(sockJsRegistration);

        CorsOriginConfiguration origins = new CorsOriginConfiguration(
            " https://energyiq.example , http://localhost:5173, ,https://energyiq.example "
        );
        new WebSocketConfig(jwtUtil, origins).registerStompEndpoints(registry);

        verify(registration).setAllowedOriginPatterns(
            "https://energyiq.example",
            "http://localhost:5173"
        );
    }
}
