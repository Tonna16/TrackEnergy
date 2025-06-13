package com.energytracker.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/tips")
@CrossOrigin(origins = "http://localhost:5173")

public class TipsController {

    @GetMapping
    public ResponseEntity<List<String>> getEnergyTips() {
        try {
            InputStream inputStream = getClass().getResourceAsStream("/tips.json");
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(inputStream);

            List<String> tips = new ArrayList<>();
            if (root.has("tips")) {
                for (JsonNode tipNode : root.get("tips")) {
                    tips.add(tipNode.asText());
                }
            }

            return ResponseEntity.ok(tips);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
