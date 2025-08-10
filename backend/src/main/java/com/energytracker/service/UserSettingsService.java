package com.energytracker.service;

import com.energytracker.model.UserSettings;
import com.energytracker.repository.UserSettingsRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserSettingsService {

    private final UserSettingsRepository settingsRepository;

    public UserSettingsService(UserSettingsRepository settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    public Optional<UserSettings> getSettingsByUserId(Long userId) {
        return settingsRepository.findByUserId(userId);
    }

    public UserSettings saveSettings(UserSettings settings) {
        return settingsRepository.save(settings);
    }

    public UserSettings getOrCreateDefaultSettings(Long userId) {
        return settingsRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserSettings defaultSettings = new UserSettings();
                    defaultSettings.setUserId(userId);
                    defaultSettings.setElectricityRatePerKWh(0.15); // Set a default rate
                    return settingsRepository.save(defaultSettings);
                });
    }

    // ✅ Add this method to make EnergyUsageService happy
    public UserSettings getUserSettings(Long userId) {
        return getOrCreateDefaultSettings(userId);
    }
}
