package com.energytracker.service;

import com.energytracker.model.User;
import com.energytracker.repository.RefreshTokenSessionRepository;
import com.energytracker.repository.UserRepository;
import com.energytracker.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthServiceEmailNormalizationTest {

    @Test
    void registerNormalizesAndStoresLowercaseTrimmedEmail() {
        UserRepository userRepo = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        RefreshTokenSessionRepository refreshRepo = mock(RefreshTokenSessionRepository.class);

        AuthService authService = new AuthService(userRepo, passwordEncoder, jwtUtil, refreshRepo);

        when(userRepo.existsByEmail("newuser@example.com")).thenReturn(false);
        when(userRepo.existsByUsername("newuser")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        when(userRepo.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User saved = authService.register("  NewUser@Example.COM ", "  New User  ", "password123", "  newuser ");

        assertEquals("newuser@example.com", saved.getEmail());
        assertEquals("New User", saved.getFullName());
        assertEquals("newuser", saved.getUsername());
    }

    @Test
    void loginLooksUpUserUsingNormalizedEmail() {
        UserRepository userRepo = mock(UserRepository.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtUtil jwtUtil = mock(JwtUtil.class);
        RefreshTokenSessionRepository refreshRepo = mock(RefreshTokenSessionRepository.class);

        AuthService authService = new AuthService(userRepo, passwordEncoder, jwtUtil, refreshRepo);

        User user = new User();
        user.setEmail("user@example.com");
        user.setPassword("hash");

        when(userRepo.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret", "hash")).thenReturn(true);

        User loggedIn = authService.login(" User@Example.com ", "secret");

        assertEquals("user@example.com", loggedIn.getEmail());
        verify(userRepo).findByEmail("user@example.com");
    }
}
