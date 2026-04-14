package com.energytracker.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private static final Logger logger = LoggerFactory.getLogger(JwtUtil.class);

    private final Key key;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    public JwtUtil(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-expiration-ms:900000}") long accessTokenExpirationMs,
        @Value("${jwt.refresh-expiration-ms:604800000}") long refreshTokenExpirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;

        logger.info("[JwtUtil] Initialized JWT signing key (configured secret present: {})", !secret.isBlank());
    }

    @PostConstruct
    private void postInit() {
        logger.info("[JwtUtil] Token expiration configuration loaded (accessMs: {}, refreshMs: {})",
            accessTokenExpirationMs,
            refreshTokenExpirationMs);
    }

    public String generateAccessToken(String email) {
        return generateToken(email, accessTokenExpirationMs);
    }

    public String generateRefreshToken(String email) {
        return generateToken(email, refreshTokenExpirationMs);
    }

    public String generateToken(String email, long expirationMs) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + expirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateAccessToken(String token) {
        try {
            Claims claims = parseClaims(token);
            boolean isExpired = claims.getExpiration().before(new Date());
            if (isExpired) {
                logger.warn("[JwtUtil] Access token rejected (reason: expired)");
                return false;
            }
            return true;
        } catch (JwtException e) {
            logger.warn("[JwtUtil] Access token rejected (reason: invalid)");
            return false;
        }
    }

    public boolean validateRefreshToken(String token) {
        try {
            Claims claims = parseClaims(token);
            boolean isExpired = claims.getExpiration().before(new Date());
            if (isExpired) {
                logger.warn("[JwtUtil] Refresh token rejected (reason: expired)");
                return false;
            }
            return true;
        } catch (JwtException e) {
            logger.warn("[JwtUtil] Refresh token rejected (reason: invalid)");
            return false;
        }
    }

    public String extractEmail(String token) {
        try {
            Claims claims = parseClaims(token);
            return claims.getSubject();
        } catch (ExpiredJwtException e) {
            logger.warn("[JwtUtil] Email extraction failed (reason: expired token)");
        } catch (JwtException | IllegalArgumentException e) {
            logger.warn("[JwtUtil] Email extraction failed (reason: invalid token)");
        }
        return null;
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
