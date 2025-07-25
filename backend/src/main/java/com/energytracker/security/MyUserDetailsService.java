package com.energytracker.security;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Collections;

@Service("myUserDetailsService")
public class MyUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public MyUserDetailsService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Loads a user by their email (used as username).
     */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        return new org.springframework.security.core.userdetails.User(
    user.getEmail(),
    user.getPassword(),
    List.of(new SimpleGrantedAuthority("ROLE_USER"))
);
    }

    /**
     * Save a new user to the database with encoded password.
     */
    public void saveUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        userRepository.save(user);
    }

    /**
     * Check if a user exists by email.
     */
    public boolean existsByEmail(String email) {
        return userRepository.findByEmail(email).isPresent();
    }
}
