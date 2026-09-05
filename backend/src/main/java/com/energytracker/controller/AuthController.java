package com.energytracker.controller;

import com.energytracker.model.User;
import com.energytracker.security.JwtUtil;
import com.energytracker.service.AuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private static final String REFRESH_COOKIE = "refreshToken";
    private static final String CSRF_COOKIE = "csrfToken";

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final boolean cookieSecure;
    private final String refreshCookieSameSite;
    private final String refreshCookiePath;
    private final String csrfCookieSameSite;
    private final String csrfCookiePath;

    public AuthController(
        AuthService authService,
        JwtUtil jwtUtil,
        @Value("${app.auth.cookie.secure:false}") boolean cookieSecure,
        @Value("${app.auth.cookie.refresh.same-site:Strict}") String refreshCookieSameSite,
        @Value("${app.auth.cookie.refresh.path:/api/auth}") String refreshCookiePath,
        @Value("${app.auth.cookie.csrf.same-site:Strict}") String csrfCookieSameSite,
        @Value("${app.auth.cookie.csrf.path:/}") String csrfCookiePath
    ) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.cookieSecure = cookieSecure;
        this.refreshCookieSameSite = refreshCookieSameSite;
        this.refreshCookiePath = refreshCookiePath;
        this.csrfCookieSameSite = csrfCookieSameSite;
        this.csrfCookiePath = csrfCookiePath;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String fullName = body.get("fullName");
            String password = body.get("password");
            String username = body.get("username");

            if (email == null || fullName == null || password == null || username == null) {
                logger.warn("Signup missing fields: {}", body.keySet());
                return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
            }

            User u = authService.register(email, fullName, password, username);
            String accessToken = jwtUtil.generateAccessToken(u.getEmail());
            String refreshToken = authService.issueRefreshToken(u.getEmail());

            logger.info("User signed up: {}", email);
            return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken).toString())
                .header(HttpHeaders.SET_COOKIE, csrfCookie().toString())
                .body(Map.of(
                    "accessToken", accessToken,
                    "user", userDto(u)
                ));
        } catch (IllegalArgumentException ex) {
            logger.error("Signup failed: {}", ex.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        try {
            String email = (String) body.get("email");
            String password = (String) body.get("password");

            if (email == null || password == null) {
                logger.warn("Login missing credentials");
                return ResponseEntity.badRequest().body(Map.of("error", "Email and password required"));
            }

            User u = authService.login(email, password);
            String accessToken = jwtUtil.generateAccessToken(u.getEmail());
            String refreshToken = authService.issueRefreshToken(u.getEmail());

            logger.info("User logged in: {}", email);
            return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(refreshToken).toString())
                .header(HttpHeaders.SET_COOKIE, csrfCookie().toString())
                .body(Map.of(
                    "accessToken", accessToken,
                    "user", userDto(u)
                ));
        } catch (IllegalArgumentException ex) {
            logger.warn("Login failed for {}: {}", body.get("email"), ex.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(
        @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
        @CookieValue(name = CSRF_COOKIE, required = false) String csrfCookie,
        @RequestHeader(name = "X-CSRF-Token", required = false) String csrfHeader
    ) {
        if (!isValidCsrf(csrfCookie, csrfHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "CSRF validation failed"));
        }

        try {
            String newRefreshToken = authService.rotateRefreshToken(refreshToken);
            String email = jwtUtil.extractEmail(newRefreshToken);
            String newAccessToken = jwtUtil.generateAccessToken(email);
            logger.info("Refreshed tokens for {}", email);

            return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(newRefreshToken).toString())
                .body(Map.of("accessToken", newAccessToken));
        } catch (IllegalArgumentException ex) {
            logger.warn("Refresh failed: {}", ex.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid refresh token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
        @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
        @CookieValue(name = CSRF_COOKIE, required = false) String csrfCookie,
        @RequestHeader(name = "X-CSRF-Token", required = false) String csrfHeader
    ) {
        if (!isValidCsrf(csrfCookie, csrfHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "CSRF validation failed"));
        }

        authService.logout(refreshToken);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString())
            .header(HttpHeaders.SET_COOKIE, clearCsrfCookie().toString())
            .body(Map.of("message", "Logged out"));
    }

    private boolean isValidCsrf(String csrfCookie, String csrfHeader) {
        return csrfCookie != null && !csrfCookie.isBlank() && csrfCookie.equals(csrfHeader);
    }

    private ResponseCookie refreshCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_COOKIE, refreshToken)
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(refreshCookieSameSite)
            .path(refreshCookiePath)
            .maxAge(Duration.ofMillis(jwtUtil.getRefreshTokenExpirationMs()))
            .build();
    }

    private ResponseCookie csrfCookie() {
        return ResponseCookie.from(CSRF_COOKIE, UUID.randomUUID().toString())
            .httpOnly(false)
            .secure(cookieSecure)
            .sameSite(csrfCookieSameSite)
            .path(csrfCookiePath)
            .maxAge(Duration.ofMillis(jwtUtil.getRefreshTokenExpirationMs()))
            .build();
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
            .httpOnly(true)
            .secure(cookieSecure)
            .sameSite(refreshCookieSameSite)
            .path(refreshCookiePath)
            .maxAge(0)
            .build();
    }

    private ResponseCookie clearCsrfCookie() {
        return ResponseCookie.from(CSRF_COOKIE, "")
            .httpOnly(false)
            .secure(cookieSecure)
            .sameSite(csrfCookieSameSite)
            .path(csrfCookiePath)
            .maxAge(0)
            .build();
    }

    private Map<String, Object> userDto(User user) {
        return Map.of(
            "username", user.getUsername(),
            "email", user.getEmail(),
            "fullName", user.getFullName()
        );
    }
}
