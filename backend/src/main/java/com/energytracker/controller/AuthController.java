package com.energytracker.controller;

import com.energytracker.security.JwtUtil;
import com.energytracker.service.AuthService;
import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import com.energytracker.dto.RefreshRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:5173")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final UserRepository userRepo;

    public AuthController(AuthService authService, JwtUtil jwtUtil, UserRepository userRepo) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.userRepo = userRepo;
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String fullName = body.get("fullName");
            String password = body.get("password");
            String username = body.get("username");

            if (email == null || password == null || username == null || fullName == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
            }

            User u = authService.register(email, fullName, password, username);
            String accessToken = jwtUtil.generateAccessToken(u.getEmail());  // ✅ Use email
            String refreshToken = jwtUtil.generateRefreshToken(u.getEmail());

            Map<String, Object> userDto = Map.of(
                "username", u.getUsername(),
                "email", u.getEmail(),
                "fullName", u.getFullName()
            );

            return ResponseEntity.ok(Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken,
                "user", userDto
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, Object> body) {
        try {
            String email = (String) body.get("email");
            String password = (String) body.get("password");
            boolean remember = Boolean.TRUE.equals(body.get("remember"));

            if (email == null || password == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email and password are required"));
            }

            User u = authService.login(email, password);
            long expiry = remember ? 1000L * 60 * 60 * 24 * 30 : 1000L * 60 * 60 * 24; // 30d vs 1d

            String accessToken = jwtUtil.generateToken(u.getEmail(), expiry); // ✅ Use email
            String refreshToken = jwtUtil.generateRefreshToken(u.getEmail());

            Map<String, Object> userDto = Map.of(
                "username", u.getUsername(),
                "email", u.getEmail(),
                "fullName", u.getFullName()
            );

            return ResponseEntity.ok(Map.of(
                "accessToken", accessToken,
                "refreshToken", refreshToken,
                "user", userDto
            ));

        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(401).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody RefreshRequest request) {
        String refreshToken = request.getRefreshToken();
        if (jwtUtil.validateRefreshToken(refreshToken)) {
            String email = jwtUtil.extractEmail(refreshToken); // ✅ Extract email
            if (email == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
            }

            String newAccessToken = jwtUtil.generateAccessToken(email);
            String newRefreshToken = jwtUtil.generateRefreshToken(email);

            return ResponseEntity.ok(Map.of(
                "accessToken", newAccessToken,
                "refreshToken", newRefreshToken
            ));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid refresh token"));
    }
}
