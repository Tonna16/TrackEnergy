package com.energytracker.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        System.out.println("[JwtAuthFilter] Filtering request to: " + req.getRequestURI());

        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            System.out.println("[JwtAuthFilter] Raw token: " + token);

            // Validate token before extracting email
            boolean valid = jwtUtil.validateAccessToken(token);
            if (!valid) {
                System.out.println("[JwtAuthFilter] JWT invalid or expired → 401");
                res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                res.getWriter().write("Invalid or expired JWT token");
                return;
            }

            String email = jwtUtil.extractEmail(token);
            if (email == null) {
                System.out.println("[JwtAuthFilter] Failed to extract email from token → 401");
                res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                res.getWriter().write("Invalid JWT token");
                return;
            }

            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
                var auth = new UsernamePasswordAuthenticationToken(
                    email, // principal
                    null,  // credentials
                    authorities
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
                System.out.println("[JwtAuthFilter] Authenticated email: " + email);
            }
        } else {
            System.out.println("[JwtAuthFilter] No bearer token found");
        }

        chain.doFilter(req, res);
    }
}
