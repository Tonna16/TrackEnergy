package com.energytracker.controller;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.model.User;
import com.energytracker.service.EnergyReportPdfService;
import com.energytracker.service.EnergyUsageService;
import com.energytracker.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EnergyUsageControllerDailyUsageTest {
    private EnergyUsageService usageService;
    private UserService userService;
    private EnergyUsageController controller;

    @BeforeEach
    void setUp() {
        usageService = mock(EnergyUsageService.class);
        userService = mock(UserService.class);
        controller = new EnergyUsageController(usageService, userService, mock(EnergyReportPdfService.class));

        User user = new User();
        user.setId(7L);
        user.setEmail("demo@example.com");
        when(userService.getUserByEmail("demo@example.com")).thenReturn(user);

        UserDetails principal = org.springframework.security.core.userdetails.User
            .withUsername("demo@example.com")
            .password("unused")
            .authorities(new SimpleGrantedAuthority("ROLE_USER"))
            .build();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
        );
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void recordedZeroIsStillReportedAsRecordedUsage() {
        LocalDate today = LocalDate.now();
        when(usageService.getUsageDataByUser(eq(7L), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of(new EnergyUsageDTO(today, 11L, "Refrigerator", 0.0)));

        Map<?, ?> body = responseBody(controller.getDailyUsageFor("today"));

        assertThat(body.get("date")).isEqualTo(today.toString());
        assertThat(body.get("totalKwh")).isEqualTo(0.0);
        assertThat(body.get("hasRecordedUsage")).isEqualTo(true);
    }

    @Test
    void missingRowsAreNotReportedAsRecordedUsage() {
        when(usageService.getUsageDataByUser(eq(7L), any(LocalDate.class), any(LocalDate.class)))
            .thenReturn(List.of());

        Map<?, ?> body = responseBody(controller.getDailyUsageFor("yesterday"));

        assertThat(body.get("date")).isEqualTo(LocalDate.now().minusDays(1).toString());
        assertThat(body.get("totalKwh")).isEqualTo(0.0);
        assertThat(body.get("hasRecordedUsage")).isEqualTo(false);
    }

    @Test
    void guestResponseRetainsTheAdditiveContractWithoutClaimingAReading() {
        SecurityContextHolder.clearContext();

        Map<?, ?> body = responseBody(controller.getDailyUsageFor("today"));

        assertThat(body.containsKey("date")).isTrue();
        assertThat(body.containsKey("totalKwh")).isTrue();
        assertThat(body.containsKey("hasRecordedUsage")).isTrue();
        assertThat(body.get("totalKwh")).isEqualTo(0.0);
        assertThat(body.get("hasRecordedUsage")).isEqualTo(false);
    }

    private Map<?, ?> responseBody(ResponseEntity<?> response) {
        assertThat(response.getBody()).isInstanceOf(Map.class);
        return (Map<?, ?>) response.getBody();
    }
}
