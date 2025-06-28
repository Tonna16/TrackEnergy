package com.energytracker.controller;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(origins = "http://localhost:5173")
public class ProfileController {

    private final UserRepository userRepo;

    public ProfileController(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @GetMapping
    public ResponseEntity<?> getProfile(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        // principal.getName() is the userId (set by JwtAuthFilter)
        long userId = Long.parseLong(principal.getName());
        User u = userRepo.findById(userId)
                         .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Build the response map defensively
        Map<String,Object> resp = new HashMap<>();
        resp.put("id",        u.getId());
        resp.put("email",     u.getEmail());
        resp.put("username",  u.getUsername());
        if (u.getFullName() != null)  resp.put("fullName",  u.getFullName());
        resp.put("createdAt", u.getCreatedAt());

        return ResponseEntity.ok(resp);
    }

    // (You can leave your PUT/update logic here unchanged, or apply the same null‐safe pattern.)
}
