package com.energytracker.service;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.energytracker.dto.EIAResponse;

@Service
public class EIAService {
    private final RestTemplate restTemplate;
    private final String apiKey = "YOUR_EIA_API_KEY";

    public EIAService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }
    public Optional<Double> getNationalAverageUsage() {
        String seriesId = "SEDS.REPRB.US.H"; // Per household residential electricity (monthly MWh)
    
        String url = String.format("https://api.eia.gov/series/?api_key=%s&series_id=%s", apiKey, seriesId);
    
        try {
            ResponseEntity<EIAResponse> response = restTemplate.getForEntity(url, EIAResponse.class);
    
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                EIAResponse body = response.getBody();
    
                if (body.getSeries() != null && !body.getSeries().isEmpty()) {
                    List<List<Object>> dataPoints = body.getSeries().get(0).getData();
    
                    if (dataPoints != null && !dataPoints.isEmpty()) {
                        Object latestValueObj = dataPoints.get(0).get(1);
                        double monthlyMWh;
    
                        if (latestValueObj instanceof Number) {
                            monthlyMWh = ((Number) latestValueObj).doubleValue();
                        } else if (latestValueObj instanceof String) {
                            monthlyMWh = Double.parseDouble((String) latestValueObj);
                        } else {
                            return Optional.empty();
                        }
    
                        // Convert MWh/month to kWh/day (approximate)
                        double kWhPerDay = (monthlyMWh * 1000) / 30; // using 30 days avg
                        return Optional.of(kWhPerDay);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("EIA API fetch error: " + e.getMessage());
        }
    
        return Optional.empty();
    }
    
    

}