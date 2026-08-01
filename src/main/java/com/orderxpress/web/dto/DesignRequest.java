package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Design-Einstellungen eines Ladens speichern (Farben + Hamburger-Menue). */
public record DesignRequest(
        @NotBlank @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Farbe muss ein Hex-Wert wie #2563eb sein.") String accentColor,
        @NotBlank @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Farbe muss ein Hex-Wert wie #f4f5f7 sein.") String backgroundColor,
        Boolean categoriesAsHamburger,
        Boolean kitchenDisplayEnabled) {

    public boolean hamburgerOrDefault() {
        return categoriesAsHamburger != null && categoriesAsHamburger;
    }

    /** Fehlt der Wert (alte Clients), gilt "Kueche vorhanden". */
    public boolean kitchenEnabledOrDefault() {
        return kitchenDisplayEnabled == null || kitchenDisplayEnabled;
    }
}
