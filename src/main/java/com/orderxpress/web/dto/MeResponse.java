package com.orderxpress.web.dto;

/**
 * Wer bin ich? Damit baut das Frontend die Navigation passend zur Rolle auf
 * (Inhaber sieht alle Ansichten, Service nur Service, Kueche nur Kueche).
 */
public record MeResponse(String name,
                         String role,
                         Long restaurantId,
                         String restaurantName) {
}
