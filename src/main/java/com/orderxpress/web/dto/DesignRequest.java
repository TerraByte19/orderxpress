package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Design-Einstellungen eines Ladens speichern: Farben, Hamburger-Menue,
 *  Kuechen-Bildschirm, Hell/Dunkel (darkMode) sowie die vier Stil-Achsen Form
 *  (styleShape), Schrift (displayFont), Warenkorb-Flieger (cartFlyStyle) und
 *  Bestell-Bestaetigung (orderConfirmStyle). */
public record DesignRequest(
        @NotBlank @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Farbe muss ein Hex-Wert wie #2563eb sein.") String accentColor,
        @NotBlank @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Farbe muss ein Hex-Wert wie #f4f5f7 sein.") String backgroundColor,
        Boolean categoriesAsHamburger,
        Boolean kitchenDisplayEnabled,
        @Pattern(regexp = "SQUARE|SOFT",
                message = "Form muss SQUARE oder SOFT sein.") String styleShape,
        @Pattern(regexp = "BRICOLAGE|FRAUNCES|SPACE_GROTESK|INSTRUMENT_SERIF|MANROPE|SORA|DM_SERIF",
                message = "Unbekannte Schrift.") String displayFont,
        @Pattern(regexp = "PLUS|PHOTO",
                message = "Flieger muss PLUS oder PHOTO sein.") String cartFlyStyle,
        @Pattern(regexp = "STAMP|CHECK",
                message = "Bestaetigung muss STAMP oder CHECK sein.") String orderConfirmStyle,
        Boolean darkMode,
        @Pattern(regexp = "HOCHKLAPPEN|FADE|MITTE|VORHANG",
                message = "Unbekannter Vorhang-Stil.") String introStyle,
        @Size(max = 80, message = "Vorhang-Text darf hoechstens 80 Zeichen haben.") String introText,
        @Pattern(regexp = "LANGSAM|NORMAL|SCHNELL", message = "Unbekanntes Vorhang-Tempo.") String introSpeed,
        @Pattern(regexp = "https?://.+", message = "Link muss mit http:// oder https:// beginnen.")
        @Size(max = 200, message = "Link ist zu lang.") String instagramUrl,
        @Pattern(regexp = "https?://.+", message = "Link muss mit http:// oder https:// beginnen.")
        @Size(max = 200, message = "Link ist zu lang.") String facebookUrl,
        @Pattern(regexp = "https?://.+", message = "Link muss mit http:// oder https:// beginnen.")
        @Size(max = 200, message = "Link ist zu lang.") String websiteUrl,
        @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "Farbe muss ein Hex-Wert wie #f4f5f7 sein.") String backgroundColor2) {

    public boolean hamburgerOrDefault() {
        return categoriesAsHamburger != null && categoriesAsHamburger;
    }

    /** Fehlt der Wert (alte Clients), gilt "Kueche vorhanden". */
    public boolean kitchenEnabledOrDefault() {
        return kitchenDisplayEnabled == null || kitchenDisplayEnabled;
    }

    public String styleShapeOrDefault() {
        return (styleShape == null || styleShape.isBlank()) ? "SQUARE" : styleShape;
    }

    public String displayFontOrDefault() {
        return (displayFont == null || displayFont.isBlank()) ? "BRICOLAGE" : displayFont;
    }

    public String cartFlyStyleOrDefault() {
        return (cartFlyStyle == null || cartFlyStyle.isBlank()) ? "PLUS" : cartFlyStyle;
    }

    public String orderConfirmStyleOrDefault() {
        return (orderConfirmStyle == null || orderConfirmStyle.isBlank()) ? "CHECK" : orderConfirmStyle;
    }

    /** Fehlt der Wert (alte Clients), gilt "hell". */
    public boolean darkModeOrDefault() {
        return darkMode != null && darkMode;
    }

    public String introStyleOrDefault() {
        return (introStyle == null || introStyle.isBlank()) ? "HOCHKLAPPEN" : introStyle;
    }

    public String introSpeedOrDefault() {
        return (introSpeed == null || introSpeed.isBlank()) ? "NORMAL" : introSpeed;
    }
}
