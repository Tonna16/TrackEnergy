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
import java.util.UUID;

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

    public String generateRefreshToken(String email, String familyId, String tokenId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setSubject(email)
                .setId(tokenId)
                .claim("familyId", familyId)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + refreshTokenExpirationMs))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public String newTokenId() {
        return UUID.randomUUID().toString();
    }

    public String newFamilyId() {
        return UUID.randomUUID().toString();
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
        return getClaimSafely(token, Claims::getSubject, "email");
    }

    public String extractTokenId(String token) {
        return getClaimSafely(token, Claims::getId, "token id");
    }

    public String extractFamilyId(String token) {
        return getClaimSafely(token, claims -> claims.get("familyId", String.class), "family id");
    }

    public long getRefreshTokenExpirationMs() {
        return refreshTokenExpirationMs;
    }

    private String getClaimSafely(String token, java.util.function.Function<Claims, String> mapper, String claimName) {
        try {
            Claims claims = parseClaims(token);
            return mapper.apply(claims);
        } catch (ExpiredJwtException e) {
            logger.warn("[JwtUtil] {} extraction failed (reason: expired token)", claimName);
        } catch (JwtException | IllegalArgumentException e) {
            logger.warn("[JwtUtil] {} extraction failed (reason: invalid token)", claimName);
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
