package com.orderxpress.web.dto;

import com.orderxpress.domain.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Neuen Mitarbeiter-Login anlegen (durch den Inhaber). role ist KITCHEN oder
 * SERVICE; fehlt sie, wird KITCHEN angenommen. OWNER kann hierueber nicht
 * angelegt werden.
 */
public record CreateUserRequest(
        @NotBlank @Size(max = 100) String username,
        @NotBlank @Size(min = 6, max = 100) String password,
        UserRole role) {

    public UserRole roleOrDefault() {
        return role == null ? UserRole.KITCHEN : role;
    }
}
