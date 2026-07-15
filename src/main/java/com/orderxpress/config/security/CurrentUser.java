package com.orderxpress.config.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Kleiner Helfer, um in Services/Controllern an den aktuell angemeldeten
 * Benutzer und vor allem an dessen restaurantId zu kommen. So muss der
 * restaurantId nicht durch jede Methode als Parameter gereicht werden.
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static StoreUserDetails details() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof StoreUserDetails details) {
            return details;
        }
        throw new IllegalStateException("Kein angemeldeter Laden-Benutzer im Sicherheitskontext.");
    }

    /** Laden-Id des angemeldeten Inhabers/der Kueche. */
    public static Long restaurantId() {
        Long id = details().getRestaurantId();
        if (id == null) {
            throw new IllegalStateException("Dieser Benutzer gehoert zu keinem Laden.");
        }
        return id;
    }
}
