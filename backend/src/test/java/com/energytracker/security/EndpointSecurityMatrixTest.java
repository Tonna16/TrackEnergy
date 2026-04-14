package com.energytracker.security;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class EndpointSecurityMatrixTest {

    @Autowired
    private MockMvc mockMvc;

    @ParameterizedTest
    @CsvSource({
        "/api/auth/security-probe,404",
        "/api/tips,200",
        "/api/energy-usage/security-probe,401",
        "/api/forecast/security-probe,401",
        "/api/private/security-probe,403"
    })
    @WithAnonymousUser
    void routeMatrixAnonymous(String endpoint, int expectedStatus) throws Exception {
        mockMvc.perform(get(endpoint))
            .andExpect(status().is(expectedStatus));
    }

    @ParameterizedTest
    @CsvSource({
        "/api/auth/security-probe,404",
        "/api/tips,200",
        "/api/energy-usage/security-probe,404",
        "/api/forecast/security-probe,404",
        "/api/private/security-probe,403"
    })
    @WithMockUser(roles = "USER")
    void routeMatrixUser(String endpoint, int expectedStatus) throws Exception {
        mockMvc.perform(get(endpoint))
            .andExpect(status().is(expectedStatus));
    }

    @ParameterizedTest
    @CsvSource({
        "/api/auth/security-probe,404",
        "/api/tips,200",
        "/api/energy-usage/security-probe,404",
        "/api/forecast/security-probe,403",
        "/api/private/security-probe,403"
    })
    @WithMockUser(roles = "ADMIN")
    void routeMatrixNonUserRole(String endpoint, int expectedStatus) throws Exception {
        mockMvc.perform(get(endpoint))
            .andExpect(status().is(expectedStatus));
    }
}
