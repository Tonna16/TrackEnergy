package com.energytracker.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Enumeration;
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

        System.out.println("[JwtHandshakeInterceptor] Incoming WebSocket handshake request");

        String token = null;

        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpServletRequest = servletRequest.getServletRequest();

            System.out.println("[JwtHandshakeInterceptor] Request URI: " + httpServletRequest.getRequestURI());

            // Print headers for debugging
            Enumeration<String> headerNames = httpServletRequest.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String headerName = headerNames.nextElement();
                System.out.println("  " + headerName + ": " + httpServletRequest.getHeader(headerName));
            }

            // First try Authorization header (optional for fallback)
            String authHeader = httpServletRequest.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
                System.out.println("[JwtHandshakeInterceptor] Found JWT in Authorization header.");
            }

            // Then try query param — your frontend uses this!
            if (token == null) {
                token = httpServletRequest.getParameter("token");
                if (token != null) {
                    System.out.println("[JwtHandshakeInterceptor] Found JWT in query parameter.");
                }
            }

            // Final check
            if (token != null) {
                System.out.println("[JwtHandshakeInterceptor] Raw JWT token: " + token);
            } else {
                System.out.println("[JwtHandshakeInterceptor] ❌ No JWT token found in handshake. Rejecting.");
                return false;
            }

            // Validate and extract email
            String email;
            try {
                email = jwtUtil.extractEmail(token);
            } catch (Exception e) {
                System.out.println("[JwtHandshakeInterceptor] ❌ Invalid JWT token. " + e.getMessage());
                return false;
            }

            if (email == null) {
                System.out.println("[JwtHandshakeInterceptor] ❌ Could not extract email from token.");
                return false;
            }

            attributes.put("userEmail", email);
            System.out.println("[JwtHandshakeInterceptor] ✅ WebSocket handshake authenticated for user: " + email);
        }

        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception ex) {
        System.out.println("[JwtHandshakeInterceptor] Handshake completed.");
        if (ex != null) {
            System.out.println("[JwtHandshakeInterceptor] Exception during handshake: " + ex.getMessage());
        }
    }
}
