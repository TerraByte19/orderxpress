package com.orderxpress.web.dto;

import jakarta.validation.constraints.Size;

/**
 * Kuechen-Login aendern: aktiv/inaktiv schalten und/oder Passwort neu setzen.
 * Beide Felder sind optional - was null ist, bleibt unveraendert.
 */
public record UpdateUserRequest(
        Boolean active,
        @Size(min = 6, max = 100) String password) {
}
