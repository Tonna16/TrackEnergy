package com.energytracker.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.energytracker.service.EnergySavingTipsService;
@RestController
@RequestMapping("/api/energy-tips")
public class EnergySavingTipsController {

    @Autowired
    private EnergySavingTipsService tipsService;

    @GetMapping
    public ResponseEntity<String> getTip() {
        return ResponseEntity.ok(tipsService.getRandomTip());
    }
}
