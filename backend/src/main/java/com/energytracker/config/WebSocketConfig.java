// src/main/java/com/energytracker/config/WebSocketConfig.java
package com.energytracker.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
  @Override
  public void configureMessageBroker(@NonNull MessageBrokerRegistry r) {
    r.enableSimpleBroker("/topic");
    r.setApplicationDestinationPrefixes("/app");
  }
  @Override
  public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
    registry
      .addEndpoint("/ws")
      .setAllowedOriginPatterns("http://localhost:5173")  // must match your front-end
      .withSockJS();
  }
}
