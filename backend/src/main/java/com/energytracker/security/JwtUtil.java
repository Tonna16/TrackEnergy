package com.energytracker.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private final Key key;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;

    public JwtUtil(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.access-expiration-ms:900000}") long accessTokenExpirationMs,    // 15 minutes
        @Value("${jwt.refresh-expiration-ms:604800000}") long refreshTokenExpirationMs // 7 days
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;

        System.out.println("[JwtUtil] Initialized with secret: " + bytesToHex(secret.getBytes()));
    }

    @PostConstruct
    private void postInit() {
        System.out.println("[JwtUtil] Access token expiration: " + accessTokenExpirationMs + "ms");
        System.out.println("[JwtUtil] Refresh token expiration: " + refreshTokenExpirationMs + "ms");
    }

    public String generateAccessToken(Long userId) {
        return generateToken(userId, accessTokenExpirationMs);
    }

    public String generateRefreshToken(Long userId) {
        return generateToken(userId, refreshTokenExpirationMs);
    }

    // Fallback generator (used by /login if user chose custom expiry)
    public String generateToken(Long userId, long expirationMs) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(userId.toString())
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + expirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateRefreshToken(String token) {
        try {
            Claims claims = parseClaims(token);
            boolean isExpired = claims.getExpiration().before(new Date());
            if (isExpired) {
                System.out.println("[JwtUtil] Refresh token expired at: " + claims.getExpiration());
                return false;
            }
            return true;
        } catch (JwtException e) {
            System.out.println("[JwtUtil] Refresh token invalid: " + e.getMessage());
            return false;
        }
    }

    public Long extractUserId(String token) {
        try {
            Claims claims = parseClaims(token);
            return Long.parseLong(claims.getSubject());
        } catch (ExpiredJwtException e) {
            System.out.println("[JwtUtil] Token expired: " + e.getClaims().getExpiration());
        } catch (JwtException | IllegalArgumentException e) {
            System.out.println("[JwtUtil] Token invalid: " + e.getMessage());
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

    private static String bytesToHex(byte[] bytes) {
        var sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
