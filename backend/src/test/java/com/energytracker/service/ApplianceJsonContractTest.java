package com.energytracker.service;

import com.energytracker.model.Appliance;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ApplianceJsonContractTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void usesFrontendCompatibleHighEfficiencyFieldInBothDirections() throws Exception {
        Appliance decoded = mapper.readValue("""
            {
              "name": "Efficient refrigerator",
              "wattage": 150,
              "hoursPerDay": 8,
              "daysPerWeek": 7,
              "isHighEfficiency": true
            }
            """, Appliance.class);
        assertTrue(decoded.isHighEfficiency());

        JsonNode encoded = mapper.readTree(mapper.writeValueAsString(decoded));
        assertTrue(encoded.path("isHighEfficiency").asBoolean());
        assertFalse(encoded.has("highEfficiency"));
    }
}
