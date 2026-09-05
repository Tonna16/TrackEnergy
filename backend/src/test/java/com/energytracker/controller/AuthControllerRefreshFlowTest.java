package com.energytracker.controller;

import com.energytracker.security.JwtUtil;
import com.energytracker.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerRefreshFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    void refreshRotatesTokenAndReturnsNewAccessToken() throws Exception {
        when(authService.rotateRefreshToken("old-refresh")).thenReturn("new-refresh");
        when(jwtUtil.extractEmail("new-refresh")).thenReturn("user@example.com");
        when(jwtUtil.generateAccessToken("user@example.com")).thenReturn("new-access");
        when(jwtUtil.getRefreshTokenExpirationMs()).thenReturn(604800000L);

        mockMvc.perform(post("/api/auth/refresh")
                .cookie(new jakarta.servlet.http.Cookie("refreshToken", "old-refresh"),
                    new jakarta.servlet.http.Cookie("csrfToken", "csrf-123"))
                .header("X-CSRF-Token", "csrf-123")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").value("new-access"))
            .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refreshToken=new-refresh")));
    }

    @Test
    void refreshRejectsRevokedToken() throws Exception {
        doThrow(new IllegalArgumentException("Refresh token revoked or reused"))
            .when(authService).rotateRefreshToken(anyString());

        mockMvc.perform(post("/api/auth/refresh")
                .cookie(new jakarta.servlet.http.Cookie("refreshToken", "revoked-refresh"),
                    new jakarta.servlet.http.Cookie("csrfToken", "csrf-123"))
                .header("X-CSRF-Token", "csrf-123")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("Invalid refresh token"));
    }

    @Test
    void logoutInvalidatesSessionFamilyAndClearsCookies() throws Exception {
        doNothing().when(authService).logout(anyString());

        mockMvc.perform(post("/api/auth/logout")
                .cookie(new jakarta.servlet.http.Cookie("refreshToken", "active-refresh"),
                    new jakarta.servlet.http.Cookie("csrfToken", "csrf-123"))
                .header("X-CSRF-Token", "csrf-123"))
            .andExpect(status().isOk())
            .andExpect(cookie().maxAge("refreshToken", 0))
            .andExpect(cookie().maxAge("csrfToken", 0));

        verify(authService).logout("active-refresh");
    }
}
