package com.energytracker.controller;

import com.energytracker.model.Appliance;
import com.energytracker.repository.ApplianceRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/appliances")
@CrossOrigin(origins = "http://localhost:5173") // allow frontend to connect
public class ApplianceController {

    private final ApplianceRepository applianceRepo;

    public ApplianceController(ApplianceRepository applianceRepo) {
        this.applianceRepo = applianceRepo;
    }

    @GetMapping
    public List<Appliance> getAllAppliances() {
        return applianceRepo.findAll();
    }

    @PostMapping
    public Appliance addAppliance(@RequestBody Appliance appliance) {
        return applianceRepo.save(appliance);
    }
}
