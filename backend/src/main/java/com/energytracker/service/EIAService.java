package com.energytracker.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import com.energytracker.dto.EIAResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * EIAService
 *
 * - Fetches a per-household baseline from the EIA series (monthly MWh per household).
 * - Converts to kWh/day and adjusts by household size using a small multiplier table.
 *
 * Notes:
 * - API key should be present in application.properties as: eia.api.key=YOUR_KEY
 * - If RestTemplate bean is not configured in your app, add one (see comment below).
 */
@Service
public class EIAService {
    private static final Logger logger = LoggerFactory.getLogger(EIAService.class);

    private final RestTemplate restTemplate;

    // Inject from application.properties
    private final String apiKey;

    // Series: per-household residential electricity (monthly, units depend on series)
    // This one (SEDS.REPRB.US.H) used earlier; it returns monthly values (MWh per household).
    private static final String SERIES_ID = "SEDS.REPRB.US.H";

    // Multipliers to adjust per-household baseline for household size:
    // These approximate relative increases (1 -> 5+). You can tune numbers later.
    private static final Map<Integer, Double> HOUSEHOLD_MULTIPLIERS = Map.of(
        1, 1.0,
        2, 1.6,
        3, 2.0,
        4, 2.4,
        5, 2.8  // use for 5 or more occupants
    );

    // Fallback per-household kWh/day if the API fails (approx)
    private static final double FALLBACK_BASE_KWH_PER_DAY = 13.7; // ~5,000 kWh/year

    public EIAService(RestTemplate restTemplate, @Value("${eia.api.key:}") String apiKey) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
    }
    public Optional<Double> getNationalAverageUsage(int householdSize) {
        int sizeKey = Math.max(1, Math.min(householdSize, 5)); // 1..5
        Optional<Double> baseOpt = getBasePerHouseholdKwhPerDay();
        double multiplier = HOUSEHOLD_MULTIPLIERS.getOrDefault(sizeKey, 1.0);
    
        if (baseOpt.isPresent()) {
            double adjusted = baseOpt.get() * multiplier;
            logger.debug("[EIAService] base={} kWh/day * multiplier={} => adjusted={}", baseOpt.get(), multiplier, adjusted);
            return Optional.of(adjusted);
        } else {
            // fallback
            double adjusted = FALLBACK_BASE_KWH_PER_DAY * multiplier;
            logger.warn("[EIAService] using fallback {} kWh/day for householdSize={}", adjusted, sizeKey);
            return Optional.of(adjusted);
        }
    }
    

    private Optional<Double> getBasePerHouseholdKwhPerDay() {
        if (apiKey == null || apiKey.isBlank()) {
            logger.warn("[EIAService] no API key configured. Using fallback.");
            return Optional.empty();
        }
    
        String seriesId = SERIES_ID; 
        String urlV2 = String.format("https://api.eia.gov/v2/seriesid/%s?api_key=%s", seriesId, apiKey);
    
        try {
            ResponseEntity<EIAResponse> resp = restTemplate.getForEntity(urlV2, EIAResponse.class);
            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                EIAResponse body = resp.getBody();
                if (body.getResponse() != null && body.getResponse().getData() != null && !body.getResponse().getData().isEmpty()) {
                    EIAResponse.Series series = body.getResponse().getData().get(0);
                    if (series.getData() != null && !series.getData().isEmpty()) {
                        Object latestVal = series.getData().get(0).get(1);
                        double mwh = latestVal instanceof Number
                                ? ((Number) latestVal).doubleValue()
                                : Double.parseDouble(latestVal.toString());
                        double kwhPerDay = mwh * 1000 / 30; // convert MWh/month to kWh/day
                        logger.debug("[EIAService] v2 success: {} kWh/day", kwhPerDay);
                        return Optional.of(kwhPerDay);
                    }
                }
            } else {
                logger.warn("[EIAService] v2 endpoint non-success: {}", resp.getStatusCode());
            }
        } catch (Exception ex) {
            logger.error("[EIAService] v2 fetch failed: {}", ex.getMessage(), ex);
        }
    
        return Optional.empty();
    }

    
    
}