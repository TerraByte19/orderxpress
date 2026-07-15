package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Neuen Laden anlegen (durch den Plattform-Admin), inklusive erstem Inhaber-Login.
 * Der slug ist die URL-Kurzkennung (nur Kleinbuchstaben, Ziffern, Bindestrich).
 */
public record CreateRestaurantRequest(
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Size(max = 60) @Pattern(
                regexp = "[a-z0-9-]+",
                message = "Nur Kleinbuchstaben, Ziffern und Bindestrich erlaubt.") String slug,
        @NotBlank @Size(max = 100) String ownerUsername,
        @NotBlank @Size(min = 6, max = 100) String ownerPassword) {
}
