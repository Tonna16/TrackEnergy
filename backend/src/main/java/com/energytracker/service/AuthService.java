package com.energytracker.service;

import com.energytracker.model.RefreshTokenSession;
import com.energytracker.model.RefreshTokenStatus;
import com.energytracker.model.User;
import com.energytracker.repository.RefreshTokenSessionRepository;
import com.energytracker.repository.UserRepository;
import com.energytracker.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AuthService {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RefreshTokenSessionRepository refreshTokenSessionRepository;

    public AuthService(
        UserRepository userRepo,
        PasswordEncoder passwordEncoder,
        JwtUtil jwtUtil,
        RefreshTokenSessionRepository refreshTokenSessionRepository
    ) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.refreshTokenSessionRepository = refreshTokenSessionRepository;
    }

    public User register(String email, String fullName, String password, String username) {
        if (userRepo.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already in use");
        }
        if (userRepo.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already taken");
        }
        User u = new User();
        u.setEmail(email);
        u.setFullName(fullName);
        u.setUsername(username);
        u.setPassword(passwordEncoder.encode(password));
        return userRepo.save(u);
    }

    public User login(String email, String rawPassword) {
        User u = userRepo.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for that email"));
        if (!passwordEncoder.matches(rawPassword, u.getPassword())) {
            throw new IllegalArgumentException("Incorrect password");
        }
        return u;
    }

    @Transactional
    public String issueRefreshToken(String email) {
        String familyId = jwtUtil.newFamilyId();
        String tokenId = jwtUtil.newTokenId();
        persistRefreshTokenSession(email, familyId, tokenId);
        return jwtUtil.generateRefreshToken(email, familyId, tokenId);
    }

    @Transactional
    public String rotateRefreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank() || !jwtUtil.validateRefreshToken(refreshToken)) {
            throw new IllegalArgumentException("Invalid refresh token");
        }

        String email = jwtUtil.extractEmail(refreshToken);
        String familyId = jwtUtil.extractFamilyId(refreshToken);
        String tokenId = jwtUtil.extractTokenId(refreshToken);

        if (email == null || familyId == null || tokenId == null) {
            throw new IllegalArgumentException("Invalid refresh token");
        }

        RefreshTokenSession current = refreshTokenSessionRepository.findByTokenId(tokenId)
            .orElseThrow(() -> new IllegalArgumentException("Refresh token session not found"));

        if (!email.equals(current.getUserEmail()) || !familyId.equals(current.getFamilyId())) {
            revokeFamily(familyId);
            throw new IllegalArgumentException("Refresh token family mismatch");
        }

        if (current.getStatus() != RefreshTokenStatus.ACTIVE || current.getExpiresAt().isBefore(LocalDateTime.now())) {
            revokeFamily(familyId);
            throw new IllegalArgumentException("Refresh token revoked or reused");
        }

        String newTokenId = jwtUtil.newTokenId();
        current.setStatus(RefreshTokenStatus.ROTATED);
        current.setReplacedByTokenId(newTokenId);
        current.setLastUsedAt(LocalDateTime.now());
        refreshTokenSessionRepository.save(current);

        persistRefreshTokenSession(email, familyId, newTokenId);
        return jwtUtil.generateRefreshToken(email, familyId, newTokenId);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }

        String familyId = jwtUtil.extractFamilyId(refreshToken);
        if (familyId != null) {
            revokeFamily(familyId);
        }
    }

    private void persistRefreshTokenSession(String email, String familyId, String tokenId) {
        RefreshTokenSession session = new RefreshTokenSession();
        session.setUserEmail(email);
        session.setFamilyId(familyId);
        session.setTokenId(tokenId);
        session.setStatus(RefreshTokenStatus.ACTIVE);
        session.setExpiresAt(LocalDateTime.now().plusSeconds(jwtUtil.getRefreshTokenExpirationMs() / 1000));
        refreshTokenSessionRepository.save(session);
    }

    private void revokeFamily(String familyId) {
        List<RefreshTokenSession> family = refreshTokenSessionRepository.findByFamilyId(familyId);
        LocalDateTime now = LocalDateTime.now();
        for (RefreshTokenSession tokenSession : family) {
            if (tokenSession.getStatus() != RefreshTokenStatus.REVOKED) {
                tokenSession.setStatus(RefreshTokenStatus.REVOKED);
                tokenSession.setRevokedAt(now);
                refreshTokenSessionRepository.save(tokenSession);
            }
        }
    }
}
