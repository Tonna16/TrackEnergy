package com.energytracker.security;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class JwtLoggingSanitizationTest {

    private static final String RAW_JWT = "eyJhbGciOiJIUzI1NiJ9.payload.signature";
    private static final String SECRET = "super-secret-value-should-never-appear-in-logs";

    @AfterEach
    void clearSecurityContext() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    @Test
    void jwtUtilInitializationLogsMustNotContainSecretValue() {
        ListAppender<ILoggingEvent> appender = attachAppender(JwtUtil.class);

        new JwtUtil(SECRET, 60_000L, 120_000L);

        List<String> messages = messages(appender);
        assertThat(messages).isNotEmpty();
        assertThat(messages).noneMatch(msg -> msg.contains(SECRET));
        assertThat(messages).anyMatch(msg -> msg.contains("configured secret present: true"));
    }

    @Test
    void jwtAuthFilterLogsMustNotContainRawJwtOrSecret() throws Exception {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        when(jwtUtil.validateAccessToken(RAW_JWT)).thenReturn(true);
        when(jwtUtil.extractEmail(RAW_JWT)).thenReturn("user@example.com");

        JwtAuthFilter filter = new JwtAuthFilter(jwtUtil);
        ListAppender<ILoggingEvent> appender = attachAppender(JwtAuthFilter.class);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/forecast");
        request.addHeader("Authorization", "Bearer " + RAW_JWT);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
        assertLogsDoNotContainSensitiveValues(messages(appender), RAW_JWT, SECRET);
    }

    @Test
    void jwtHandshakeInterceptorLogsMustNotContainRawJwtOrSecret() {
        JwtUtil jwtUtil = Mockito.mock(JwtUtil.class);
        when(jwtUtil.extractEmail(RAW_JWT)).thenReturn("socket-user@example.com");

        JwtHandshakeInterceptor interceptor = new JwtHandshakeInterceptor(jwtUtil);
        ListAppender<ILoggingEvent> appender = attachAppender(JwtHandshakeInterceptor.class);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/ws");
        request.addHeader("Authorization", "Bearer " + RAW_JWT);
        ServletServerHttpRequest serverRequest = new ServletServerHttpRequest(request);
        ServletServerHttpResponse serverResponse = new ServletServerHttpResponse(new MockHttpServletResponse());

        boolean allowed = interceptor.beforeHandshake(
            serverRequest,
            serverResponse,
            Mockito.mock(WebSocketHandler.class),
            new java.util.HashMap<>(Map.of())
        );

        assertThat(allowed).isTrue();
        assertLogsDoNotContainSensitiveValues(messages(appender), RAW_JWT, SECRET);
    }

    private static ListAppender<ILoggingEvent> attachAppender(Class<?> loggerClass) {
        Logger logger = (Logger) LoggerFactory.getLogger(loggerClass);
        logger.setLevel(Level.DEBUG);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    private static List<String> messages(ListAppender<ILoggingEvent> appender) {
        List<String> messages = new ArrayList<>();
        for (ILoggingEvent event : appender.list) {
            messages.add(event.getFormattedMessage());
        }
        return messages;
    }

    private static void assertLogsDoNotContainSensitiveValues(List<String> messages, String rawJwt, String secret) {
        assertThat(messages).isNotEmpty();
        assertThat(messages).noneMatch(msg -> msg.contains(rawJwt));
        assertThat(messages).noneMatch(msg -> msg.contains("Bearer " + rawJwt));
        assertThat(messages).noneMatch(msg -> msg.contains(secret));
    }
}
