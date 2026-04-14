package com.energytracker.security;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    private final JwtUtil jwtUtil;

    public JwtHandshakeInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {

        logger.debug("[JwtHandshakeInterceptor] WebSocket handshake started");

        String token = null;

        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpServletRequest = servletRequest.getServletRequest();

            String authHeader = httpServletRequest.getHeader("Authorization");
            boolean bearerTokenPresent = authHeader != null && authHeader.startsWith("Bearer ");
            logger.debug("[JwtHandshakeInterceptor] Handshake auth material detected (uri: {}, authorizationBearerPresent: {})",
                httpServletRequest.getRequestURI(),
                bearerTokenPresent);

            if (bearerTokenPresent) {
                token = authHeader.substring(7);
            }

            if (token == null || token.isBlank()) {
                token = httpServletRequest.getParameter("token");
                logger.debug("[JwtHandshakeInterceptor] Falling back to token query parameter (present: {})",
                    token != null && !token.isBlank());
            }

            boolean tokenPresent = token != null && !token.isBlank();
            if (!tokenPresent) {
                logger.warn("[JwtHandshakeInterceptor] Rejecting handshake: token not present");
                return false;
            }

            String email;
            try {
                email = jwtUtil.extractEmail(token);
            } catch (Exception e) {
                logger.warn("[JwtHandshakeInterceptor] Rejecting handshake: token parsing failed");
                return false;
            }

            if (email == null) {
                logger.warn("[JwtHandshakeInterceptor] Rejecting handshake: token subject missing");
                return false;
            }

            attributes.put("userEmail", email);
            logger.info("[JwtHandshakeInterceptor] Handshake authenticated successfully");
        }

        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception ex) {
        if (ex != null) {
            logger.warn("[JwtHandshakeInterceptor] Handshake completed with exception");
        } else {
            logger.debug("[JwtHandshakeInterceptor] Handshake completed");
        }
    }
}
