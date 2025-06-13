// src/main/java/com/energytracker/service/UserDetailsServiceImpl.java
package com.energytracker.service;

import com.energytracker.model.User;
import com.energytracker.repository.UserRepository;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {
  private final UserRepository users;
  public UserDetailsServiceImpl(UserRepository users) {
    this.users = users;
  }

  @Override
  public UserDetails loadUserByUsername(String idString) throws UsernameNotFoundException {
    Long id = Long.valueOf(idString);
    User u = users.findById(id)
      .orElseThrow(() -> new UsernameNotFoundException("User not found: " + id));
    // we only need an Authentication principal with the same ID
    return org.springframework.security.core.userdetails.User.builder()
               .username(u.getId().toString())
               .password(u.getPassword())
               .roles() // No roles specified
               .build();
  }
}
