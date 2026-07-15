package com.orderxpress.config.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Angemeldeter Benutzer inkl. seiner Laden-Zuordnung (restaurantId).
 * Der Plattform-Admin hat restaurantId == null (er gehoert keinem Laden an).
 * Ueber {@link CurrentUser} liest der Rest der App den aktuellen restaurantId aus.
 */
public class StoreUserDetails implements UserDetails {

    private final String username;
    private final String password; // BCrypt-Hash bzw. {noop}-Klartext beim Plattform-Admin
    private final String role;      // "PLATFORM_ADMIN" | "OWNER" | "KITCHEN"
    private final Long restaurantId; // null beim Plattform-Admin
    private final boolean enabled;

    public StoreUserDetails(String username, String password, String role,
                            Long restaurantId, boolean enabled) {
        this.username = username;
        this.password = password;
        this.role = role;
        this.restaurantId = restaurantId;
        this.enabled = enabled;
    }

    public Long getRestaurantId() {
        return restaurantId;
    }

    public String getRole() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
