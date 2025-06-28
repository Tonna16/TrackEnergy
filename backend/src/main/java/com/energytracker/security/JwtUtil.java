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
    private final long defaultExpirationMs;

    public JwtUtil(
        @Value("${jwt.secret}") String secret,
        @Value("${jwt.expiration-ms:86400000}") long defaultExpirationMs
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.defaultExpirationMs = defaultExpirationMs;
        System.out.println("[JwtUtil] Initialized with secret: " + bytesToHex(secret.getBytes()));
    }

    @PostConstruct
    private void postInit() {
        System.out.println("[JwtUtil] Ready. Default expiration: " + defaultExpirationMs + " ms");
    }

    public String generateToken(Long userId) {
        return generateToken(userId, defaultExpirationMs);
    }

    public String generateToken(Long userId, long expirationMs) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(userId.toString())
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

            String subject = claims.getSubject();
            System.out.println("[JwtUtil] Token OK → sub=" + subject);
            return Long.parseLong(subject);
        } catch (ExpiredJwtException e) {
            System.out.println("[JwtUtil] Token EXPIRED at: " + e.getClaims().getExpiration());
        } catch (JwtException | IllegalArgumentException e) {
            System.out.println("[JwtUtil] Token INVALID: " + e.getMessage());
        }
        return null;
    }

    private static String bytesToHex(byte[] bytes) {
        var sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
