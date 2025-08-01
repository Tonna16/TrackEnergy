package com.energytracker.controller;

import com.energytracker.model.Appliance;
import com.energytracker.model.User;
import com.energytracker.service.ApplianceService;
import com.energytracker.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/appliances")
@CrossOrigin(origins = "http://localhost:5173")
public class ApplianceController {

    private final ApplianceService applianceService;
    private final UserService userService;
    private static final Logger logger = LoggerFactory.getLogger(ApplianceController.class);

    public ApplianceController(ApplianceService applianceService, UserService userService) {
        this.applianceService = applianceService;
        this.userService = userService;
    }

    private User getAuthenticatedUserOrNull() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof String email && !"anonymousUser".equals(email)) {
            logger.debug("Authenticated user: {}", email);
            return userService.getUserByEmail(email);
        }
        logger.debug("Guest user detected");
        return null;
    }
    
    
    

    @GetMapping
public ResponseEntity<List<Appliance>> list() {
    User user = getAuthenticatedUserOrNull();
    logger.debug("GET /api/appliances - userId: {}", user != null ? user.getId() : "guest");
    List<Appliance> appliances = applianceService.listUserAppliances(user != null ? user.getId() : null);
    logger.debug("Returning {} appliances", appliances.size());
    return ResponseEntity.ok(appliances);
}


@PostMapping
public ResponseEntity<Appliance> create(@RequestBody Appliance payload) {
    User user = getAuthenticatedUserOrNull();

    if (user != null) {
        payload.setUser(user); // associate appliance with user
    } else {
        logger.warn("Guest appliance creation - consider whether this is allowed");
    }

    logger.debug("POST /api/appliances - Creating appliance: {}, for userId: {}", payload.getName(), user != null ? user.getId() : "guest");
    Appliance created = applianceService.createAppliance(user != null ? user.getId() : null, payload);
    return ResponseEntity.ok(created);
}


@PutMapping("/{applianceId}")
public ResponseEntity<Appliance> update(@PathVariable Long applianceId, @RequestBody Appliance payload) {
    User user = getAuthenticatedUserOrNull();
    logger.debug("PUT /api/appliances/{} - Updating appliance to: {}, for userId: {}", applianceId, payload.getName(), user != null ? user.getId() : "guest");
    Appliance updated = applianceService.updateAppliance(user != null ? user.getId() : null, applianceId, payload);
    return ResponseEntity.ok(updated);
}


@DeleteMapping("/{applianceId}")
public ResponseEntity<Void> delete(@PathVariable Long applianceId) {
    User user = getAuthenticatedUserOrNull();
    logger.debug("DELETE /api/appliances/{} - for userId: {}", applianceId, user != null ? user.getId() : "guest");
    applianceService.deleteAppliance(user != null ? user.getId() : null, applianceId);
    return ResponseEntity.ok().build();
}

}
