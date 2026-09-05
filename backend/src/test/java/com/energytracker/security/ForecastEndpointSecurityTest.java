package com.energytracker.security;

import com.energytracker.config.CorsOriginConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ForecastEndpointSecurityTest.TestForecastController.class)
@Import({SecurityConfig.class, CorsOriginConfiguration.class})
class ForecastEndpointSecurityTest {

    @org.springframework.web.bind.annotation.RestController
    static class TestForecastController {
        @org.springframework.web.bind.annotation.GetMapping("/api/forecast/next-week")
        String nextWeek() { return "ok"; }
    }

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    void unauthenticatedForecastRequestReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/forecast/next-week"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void authenticatedWithoutUserRoleForecastRequestReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/forecast/next-week"))
                .andExpect(status().isForbidden());
    }
}
