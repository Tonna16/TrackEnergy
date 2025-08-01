package com.energytracker.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private static final Logger logger = LoggerFactory.getLogger(JwtAuthFilter.class);

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }
    

    @Override
protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ServletException, IOException {

    System.out.println("[JwtAuthFilter] 🔍 Filtering request to: " + req.getRequestURI());

    String header = req.getHeader("Authorization");
    System.out.println("[JwtAuthFilter] Authorization header: " + header);

    if (header == null || !header.startsWith("Bearer ")) {
        System.out.println("[JwtAuthFilter] ⚠️ No bearer token found - allowing guest access");
        chain.doFilter(req, res);
        return;
    }

    String token = header.substring(7);
    System.out.println("[JwtAuthFilter] Raw token: " + token);
    System.out.println("[JwtAuthFilter] JwtAuthFilter engaged for URI: " + req.getRequestURI());

    boolean valid = jwtUtil.validateAccessToken(token);
    if (!valid) {
        System.out.println("[JwtAuthFilter] ❌ JWT invalid or expired - skipping auth");
        SecurityContextHolder.clearContext();
        chain.doFilter(req, res);
        return;
    }

    String email = jwtUtil.extractEmail(token);
    if (email == null) {
        System.out.println("[JwtAuthFilter] ❌ Failed to extract email from token - skipping auth");
        SecurityContextHolder.clearContext();
        chain.doFilter(req, res);
        return;
    }

    if (SecurityContextHolder.getContext().getAuthentication() == null) {
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        var auth = new UsernamePasswordAuthenticationToken(email, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
        System.out.println("[JwtAuthFilter] ✅ Authenticated email: " + email);
    }

    chain.doFilter(req, res);
    System.out.println("[JwtAuthFilter] ✅ Finished filtering " + req.getRequestURI());
}

}
