package com.energytracker.security;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    public JwtHandshakeInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) throws Exception {

        String token = null;

        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpServletRequest = servletRequest.getServletRequest();

            // First, try header
            String authHeader = httpServletRequest.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }

            // If no header token, try query param (e.g. ws?token=...)
            if (token == null) {
                token = httpServletRequest.getParameter("token");
            }
        }

        if (token == null) {
            System.out.println("[JwtHandshakeInterceptor] No JWT token found in handshake");
            return false;  // Reject connection
        }

        String email = jwtUtil.extractEmail(token);
        if (email == null) {
            System.out.println("[JwtHandshakeInterceptor] Invalid JWT token in handshake");
            return false;  // Reject connection
        }

        // Store the email in attributes for later use if needed
        attributes.put("userEmail", email);

        System.out.println("[JwtHandshakeInterceptor] WebSocket handshake authenticated for user: " + email);

        return true; // Accept connection
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception ex) {
        // No-op
    }
}
