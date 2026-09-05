package com.util;

import com.energytracker.model.User;
import com.energytracker.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SecurityUtils {

    private static final Logger logger = LoggerFactory.getLogger(SecurityUtils.class);

    private static UserService userService;

    // Injected by Spring, this allows static access
    public static void setUserService(UserService service) {
        userService = service;
    }

    public static User getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            logger.warn("No authenticated user found in SecurityContext");

            throw new RuntimeException("No authenticated user");
        }
    
        String email = authentication.getName();
        User user = userService.getUserByEmail(email);
        if (user == null) {
            logger.warn("Authenticated user not found in DB for email={}", email);
            throw new RuntimeException("Authenticated user not found");
        }
    
        return user;
    }
    
}
