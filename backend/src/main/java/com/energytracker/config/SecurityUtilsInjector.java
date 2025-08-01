package com.energytracker.config;

import com.energytracker.service.UserService;
import com.util.SecurityUtils;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class SecurityUtilsInjector {

    private final UserService userService;

    public SecurityUtilsInjector(UserService userService) {
        this.userService = userService;
    }

    @PostConstruct
    public void init() {
        SecurityUtils.setUserService(userService);
    }
}
