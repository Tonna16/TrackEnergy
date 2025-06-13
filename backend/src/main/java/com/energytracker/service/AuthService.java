package com.energytracker.service;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepo, PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
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
}
