// src/main/java/com/energytracker/security/JwtUtil.java
package com.energytracker.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    private final Key key;
    private final long expirationMs;

    public JwtUtil(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.expiration-ms:86400000}") long expirationMs
    ) {
        // secret must be at least 32 bytes for HS256
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    public String generateToken(Long userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(String.valueOf(userId))
                .claim("userId", userId)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + expirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Long extractUserId(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(key)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
