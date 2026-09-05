package com.energytracker.service;

import com.energytracker.model.UserSettings;
import com.energytracker.repository.UserSettingsRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserSettingsService {

    private final UserSettingsRepository settingsRepository;
    private final EnergyDomainConfig domain;

    public UserSettingsService(UserSettingsRepository settingsRepository, EnergyDomainConfig domain) {
        this.settingsRepository = settingsRepository;
        this.domain = domain;
    }

    public Optional<UserSettings> getSettingsByUserId(Long userId) {
        return settingsRepository.findByUserId(userId);
    }

    public UserSettings saveSettings(UserSettings settings) {
        settings.setCurrency("EUR".equalsIgnoreCase(settings.getCurrency()) ? "EUR" : "USD");
        if (!Double.isFinite(settings.getElectricityRatePerKWh()) || settings.getElectricityRatePerKWh() < 0.0) {
            throw new IllegalArgumentException("electricityRate must be a non-negative number.");
        }
        return settingsRepository.save(settings);
    }

    public UserSettings getOrCreateDefaultSettings(Long userId) {
        return settingsRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserSettings defaultSettings = new UserSettings();
                    defaultSettings.setUserId(userId);
                    defaultSettings.setElectricityRatePerKWh(domain.getDefaultElectricityRate());
                    defaultSettings.setCurrency(domain.getDefaultCurrency());
                    return settingsRepository.save(defaultSettings);
                });
    }

    // ✅ Add this method to make EnergyUsageService happy
    public UserSettings getUserSettings(Long userId) {
        return getOrCreateDefaultSettings(userId);
    }

    public double getDefaultElectricityRate() { return domain.getDefaultElectricityRate(); }
    public String getDefaultCurrency() { return domain.getDefaultCurrency(); }
}
