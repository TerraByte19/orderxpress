package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Design-Einstellungen eines Ladens speichern: Farben, Hamburger-Menue,
 *  Kuechen-Bildschirm, Hell/Dunkel (darkMode) sowie die vier Stil-Achsen Form
 *  (styleShape), Schrift (displayFont), Warenkorb-Flieger (cartFlyStyle) und
 *  Bestell-Bestaetigung (orderConfirmStyle).
 *
 *  Dazu die sechs Struktur-Achsen menuLayout, heroStyle, textureStyle,
 *  controlStyle, categoryStyle und motionLevel - sie aendern Aufbau und
 *  Rhythmus der Gaeste-Seite, nicht nur ihre Farbe (siehe Restaurant). */
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
        @Pattern(regexp = "HOCHKLAPPEN|FADE|MITTE|VORHANG|KINO",
                message = "Unbekannter Vorhang-Stil.") String introStyle,
        @Size(max = 80, message = "Vorhang-Text darf hoechstens 80 Zeichen haben.") String introText,
        @Pattern(regexp = "LANGSAM|NORMAL|SCHNELL", message = "Unbekanntes Vorhang-Tempo.") String introSpeed,
        @Pattern(regexp = "https?://.+", message = "Link muss mit http:// oder https:// beginnen.")
        @Size(max = 200, message = "Link ist zu lang.") String instagramUrl,
        @Pattern(regexp = "https?://.+", message = "Link muss mit http:// oder https:// beginnen.")
        @Size(max = 200, message = "Link ist zu lang.") String facebookUrl,
        @Pattern(regexp = "https?://.+", message = "Link muss mit http:// oder https:// beginnen.")
        @Size(max = 200, message = "Link ist zu lang.") String websiteUrl,
        @Pattern(regexp = "#[0-9a-fA-F]{6}", message = "Farbe muss ein Hex-Wert wie #f4f5f7 sein.") String backgroundColor2,
        @Size(max = 500, message = "Oeffnungszeiten sind zu lang.") String openingHours,
        @Size(max = 200, message = "Adresse ist zu lang.") String address,
        @Size(max = 40, message = "Telefonnummer ist zu lang.") String phone,
        @Pattern(regexp = "LISTE|KACHELN|TAFEL",
                message = "Karten-Aufbau muss LISTE, KACHELN oder TAFEL sein.") String menuLayout,
        @Pattern(regexp = "BAND|VOLL|SCHLICHT",
                message = "Kopf muss BAND, VOLL oder SCHLICHT sein.") String heroStyle,
        @Pattern(regexp = "KEIN|PAPIER|LINIEN|TERRAZZO",
                message = "Unbekannte Textur.") String textureStyle,
        @Pattern(regexp = "FLACH|RAHMEN|ERHOBEN",
                message = "Knopf-Optik muss FLACH, RAHMEN oder ERHOBEN sein.") String controlStyle,
        @Pattern(regexp = "REITER|HAMBURGER|KAPITEL",
                message = "Kategorien-Navigation muss REITER, HAMBURGER oder KAPITEL sein.") String categoryStyle,
        @Pattern(regexp = "DEZENT|NORMAL|VERSPIELT",
                message = "Bewegungsstaerke muss DEZENT, NORMAL oder VERSPIELT sein.") String motionLevel,
        @Pattern(regexp = "#[0-9a-fA-F]{6}",
                message = "Vorhang-Farbe muss ein Hex-Wert wie #7a1f2b sein.") String introColor,
        @Pattern(regexp = "OHNE|KLEIN|GROSS",
                message = "Logo auf dem Vorhang muss OHNE, KLEIN oder GROSS sein.") String introLogo,
        @Pattern(regexp = "OHNE|KURZ|NORMAL|LANG",
                message = "Haltezeit muss OHNE, KURZ, NORMAL oder LANG sein.") String introHold,
        @Pattern(regexp = "IMMER|EINMAL",
                message = "Wiederholung muss IMMER oder EINMAL sein.") String introRepeat,
        @Pattern(regexp = "AUFGELEGT|FLAECHE",
                message = "Vorhang-Bild muss AUFGELEGT oder FLAECHE sein.") String introImageStyle) {

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

    // ---------- Struktur-Achsen ----------

    private static String orDefault(String wert, String fallback) {
        return (wert == null || wert.isBlank()) ? fallback : wert;
    }

    public String menuLayoutOrDefault() {
        return orDefault(menuLayout, "LISTE");
    }

    public String heroStyleOrDefault() {
        return orDefault(heroStyle, "BAND");
    }

    public String textureStyleOrDefault() {
        return orDefault(textureStyle, "KEIN");
    }

    public String controlStyleOrDefault() {
        return orDefault(controlStyle, "FLACH");
    }

    /**
     * Fehlt die Achse (alte Clients), entscheidet weiterhin der Schalter
     * categoriesAsHamburger - so aendert ein alter Client beim Speichern
     * nichts an der Navigation.
     */
    public String categoryStyleOrDefault() {
        if (categoryStyle == null || categoryStyle.isBlank()) {
            return hamburgerOrDefault() ? "HAMBURGER" : "REITER";
        }
        return categoryStyle;
    }

    public String motionLevelOrDefault() {
        return orDefault(motionLevel, "NORMAL");
    }

    public String introLogoOrDefault() {
        return orDefault(introLogo, "KLEIN");
    }

    public String introHoldOrDefault() {
        return orDefault(introHold, "NORMAL");
    }

    public String introRepeatOrDefault() {
        return orDefault(introRepeat, "IMMER");
    }

    public String introImageStyleOrDefault() {
        return orDefault(introImageStyle, "AUFGELEGT");
    }
}
