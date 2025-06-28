// src/main/java/com/energytracker/service/UserDetailsServiceImpl.java
package com.energytracker.service;

import com.energytracker.model.User;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

  private final UserService userService;

  public UserDetailsServiceImpl(UserService userService) {
    this.userService = userService;
  }

  @Override
  public UserDetails loadUserByUsername(String idString) throws UsernameNotFoundException {
    Long id;
    try {
      id = Long.valueOf(idString);
    } catch (NumberFormatException e) {
      throw new UsernameNotFoundException("Invalid user ID format: " + idString);
    }
    
    // Use UserService to fetch the full User entity
    User u = userService.getUserById(id);

    // Here you can add roles/authorities if your User has roles
    return org.springframework.security.core.userdetails.User.builder()
               .username(u.getEmail()) // use email as username here
               .password(u.getPassword())
               .roles("USER")  // or load actual roles if you have them
               .build();
  }
}

