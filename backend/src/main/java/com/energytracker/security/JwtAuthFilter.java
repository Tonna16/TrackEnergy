package com.energytracker.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String header = req.getHeader("Authorization");
        boolean bearerTokenPresent = header != null && header.startsWith("Bearer ");

        logger.debug("[JwtAuthFilter] Processing request (uri: {}, bearerTokenPresent: {})",
            req.getRequestURI(),
            bearerTokenPresent);

        if (!bearerTokenPresent) {
            logger.debug("[JwtAuthFilter] No bearer token present; continuing as unauthenticated request");
            chain.doFilter(req, res);
            return;
        }

        String token = header.substring(7);
        boolean valid = jwtUtil.validateAccessToken(token);
        if (!valid) {
            logger.warn("[JwtAuthFilter] Rejecting request due to invalid access token (uri: {})", req.getRequestURI());
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.getWriter().write("{\"error\":\"Invalid or expired token\"}");
            return;
        }

        String email = jwtUtil.extractEmail(token);
        if (email == null) {
            logger.warn("[JwtAuthFilter] Rejecting request due to missing subject in validated token (uri: {})", req.getRequestURI());
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.getWriter().write("{\"error\":\"Invalid token\"}");
            return;
        }

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            var auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
            logger.info("[JwtAuthFilter] Authentication context established for request (uri: {})", req.getRequestURI());
        }

        chain.doFilter(req, res);
        logger.debug("[JwtAuthFilter] Request processing completed (uri: {})", req.getRequestURI());
    }
}
