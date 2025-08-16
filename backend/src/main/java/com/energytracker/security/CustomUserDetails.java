package com.energytracker.security;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.GrantedAuthority;
import java.util.Collection;

public class CustomUserDetails extends User {
    private final com.energytracker.model.User user; // Your actual User entity

    public CustomUserDetails(com.energytracker.model.User user, Collection<? extends GrantedAuthority> authorities) {
        super(user.getUsername(), user.getPassword(), authorities);
        this.user = user;
    }

    public com.energytracker.model.User getUser() {
        return user;
    }
}
