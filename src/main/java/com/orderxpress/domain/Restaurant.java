package com.orderxpress.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

/**
 * Ein Laden (Restaurant) auf der Plattform. Alle Tische, Kategorien, Gerichte,
 * Sitzungen und Bestellungen gehoeren zu genau einem Restaurant. Der
 * Plattform-Admin legt Restaurants an, jeder Laden sieht nur seine eigenen Daten.
 *
 * Die Design-Felder erlauben es jedem Laden, seine Gaeste-Seite individuell zu
 * gestalten (Akzentfarbe, Hintergrundfarbe, Kategorien als Hamburger-Menue).
 * Logo und Hintergrundbild liegen als eigene Datensaetze in {@link RestaurantAsset}.
 */
@Entity
@Table(name = "restaurants")
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Anzeigename, z.B. "Pizzeria Bella". */
    @Column(nullable = false, length = 150)
    private String name;

    /** Kurzkennung fuer URLs, eindeutig, z.B. "bella". */
    @Column(nullable = false, unique = true, length = 60)
    private String slug;

    @Column(nullable = false)
    private boolean active = true;

    // ---------- Design ----------

    /** Akzentfarbe (Buttons, Hervorhebungen) als Hex, z.B. "#2563eb". */
    @Column(name = "accent_color", nullable = false, length = 20)
    private String accentColor = "#2563eb";

    /** Hintergrundfarbe der Gaeste-Seite als Hex, z.B. "#f4f5f7". */
    @Column(name = "background_color", nullable = false, length = 20)
    private String backgroundColor = "#f4f5f7";

    /** true = Kategorien als aufklappbares Hamburger-Menue statt fester Liste. */
    @Column(name = "categories_as_hamburger", nullable = false)
    private boolean categoriesAsHamburger = false;

    /**
     * true = der Laden nutzt einen Kuechen-Bildschirm (Kuechen-Monitor). false =
     * es gibt kein Geraet in der Kueche, gearbeitet wird nur mit dem gedruckten Bon.
     * Nullable, damit bestehende Datenbanken ohne Reset auskommen (null gilt als true).
     */
    @Column(name = "kitchen_display_enabled")
    private Boolean kitchenDisplayEnabled = Boolean.TRUE;

    /** Form der Gaeste-Seite: "SQUARE" (eckig) oder "SOFT" (weiche Radien). null/leer = SQUARE. */
    @Column(name = "style_shape", length = 20)
    private String styleShape;

    /** Ueberschrift-/Gerichtnamen-Schrift: BRICOLAGE | FRAUNCES | SPACE_GROTESK | INSTRUMENT_SERIF. null/leer = BRICOLAGE. */
    @Column(name = "display_font", length = 30)
    private String displayFont;

    /** Was beim Hinzufuegen zum Warenkorb-Zaehler fliegt: "PLUS" oder "PHOTO". null/leer = PLUS. */
    @Column(name = "cart_fly_style", length = 20)
    private String cartFlyStyle;

    /** Bestaetigung nach dem Bestellen: "STAMP" (Stempel) oder "CHECK" (Haken). null/leer = CHECK. */
    @Column(name = "order_confirm_style", length = 20)
    private String orderConfirmStyle;

    /** Vorhang-Animation beim ersten Oeffnen der Speisekarte: HOCHKLAPPEN |
     *  FADE | MITTE | VORHANG. null/leer = HOCHKLAPPEN. */
    @Column(name = "intro_style", length = 20)
    private String introStyle;

    /** Kurzer Willkommenstext, der waehrend des Vorhangs kurz eingeblendet
     *  wird (zusammen mit dem Logo, falls vorhanden). null/leer = keiner -
     *  dann laeuft der Vorhang ohne Halt/Einblendung durch. */
    @Column(name = "intro_text", length = 80)
    private String introText;

    /** Tempo der Vorhang-Animation: LANGSAM | NORMAL | SCHNELL. null/leer = NORMAL. */
    @Column(name = "intro_speed", length = 20)
    private String introSpeed;

    /** Social-Links fuer die Gaeste-Seite - alle optional, nur gesetzte
     *  werden angezeigt. Volle URL erwartet (https://...), keine Validierung
     *  ueber ein festes Format hinaus (siehe DesignRequest). */
    @Column(name = "instagram_url", length = 200)
    private String instagramUrl;

    @Column(name = "facebook_url", length = 200)
    private String facebookUrl;

    @Column(name = "website_url", length = 200)
    private String websiteUrl;

    /** Zweite Hintergrundfarbe - gesetzt ergibt einen Verlauf statt Vollton
     *  (siehe frontend theme.ts). null = kein Verlauf. */
    @Column(name = "background_color2", length = 7)
    private String backgroundColor2;

    /**
     * true = die Gaeste-Seite nutzt die dunkle Haut (data-theme="dark"). Nullable,
     * damit bestehende Datenbanken ohne Reset auskommen; null gilt als hell.
     */
    @Column(name = "dark_mode")
    private Boolean darkMode;

    /** Oeffnungszeiten als freier Text (mehrzeilig), z.B. "Mo-Fr 8-18 Uhr". null = keine hinterlegt. */
    @Column(name = "opening_hours", length = 500)
    private String openingHours;

    /** Anschrift des Ladens, z.B. "Musterstr. 1, 12345 Berlin". null = keine hinterlegt. */
    @Column(name = "address", length = 200)
    private String address;

    /** Telefonnummer fuer Anruf/WhatsApp-Link im Footer. null = keine hinterlegt. */
    @Column(name = "phone", length = 40)
    private String phone;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /**
     * Ab diesem Zeitpunkt zaehlt die Statistik (der Inhaber hat sie zurueckgesetzt).
     * null = seit Anbeginn. Die Bestellungen selbst bleiben erhalten, werden aber
     * vor diesem Zeitpunkt nicht mehr mitgezaehlt.
     */
    @Column(name = "stats_reset_at")
    private Instant statsResetAt;

    protected Restaurant() {
        // fuer JPA
    }

    public Restaurant(String name, String slug) {
        this.name = name;
        this.slug = slug;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public String getAccentColor() {
        return accentColor;
    }

    public void setAccentColor(String accentColor) {
        this.accentColor = accentColor;
    }

    public String getBackgroundColor() {
        return backgroundColor;
    }

    public void setBackgroundColor(String backgroundColor) {
        this.backgroundColor = backgroundColor;
    }

    public boolean isCategoriesAsHamburger() {
        return categoriesAsHamburger;
    }

    public void setCategoriesAsHamburger(boolean categoriesAsHamburger) {
        this.categoriesAsHamburger = categoriesAsHamburger;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStatsResetAt() {
        return statsResetAt;
    }

    public void setStatsResetAt(Instant statsResetAt) {
        this.statsResetAt = statsResetAt;
    }

    /** null (alte Datensaetze) gilt als "Kueche vorhanden". */
    public boolean isKitchenDisplayEnabled() {
        return kitchenDisplayEnabled == null || kitchenDisplayEnabled;
    }

    public void setKitchenDisplayEnabled(boolean kitchenDisplayEnabled) {
        this.kitchenDisplayEnabled = kitchenDisplayEnabled;
    }

    private static String orDefault(String wert, String fallback) {
        return (wert == null || wert.isBlank()) ? fallback : wert;
    }

    public String getStyleShape() {
        return orDefault(styleShape, "SQUARE");
    }

    public void setStyleShape(String v) {
        this.styleShape = v;
    }

    public String getDisplayFont() {
        return orDefault(displayFont, "BRICOLAGE");
    }

    public void setDisplayFont(String v) {
        this.displayFont = v;
    }

    public String getCartFlyStyle() {
        return orDefault(cartFlyStyle, "PLUS");
    }

    public void setCartFlyStyle(String v) {
        this.cartFlyStyle = v;
    }

    public String getIntroStyle() {
        return orDefault(introStyle, "HOCHKLAPPEN");
    }

    public void setIntroStyle(String v) {
        this.introStyle = v;
    }

    /** null statt "" (kein orDefault - leer bedeutet hier "keiner", nicht "Standardwert"). */
    public String getIntroText() {
        return (introText == null || introText.isBlank()) ? null : introText;
    }

    public void setIntroText(String v) {
        this.introText = v;
    }

    public String getIntroSpeed() {
        return orDefault(introSpeed, "NORMAL");
    }

    public void setIntroSpeed(String v) {
        this.introSpeed = v;
    }

    public String getInstagramUrl() {
        return (instagramUrl == null || instagramUrl.isBlank()) ? null : instagramUrl;
    }

    public void setInstagramUrl(String v) {
        this.instagramUrl = v;
    }

    public String getFacebookUrl() {
        return (facebookUrl == null || facebookUrl.isBlank()) ? null : facebookUrl;
    }

    public void setFacebookUrl(String v) {
        this.facebookUrl = v;
    }

    public String getWebsiteUrl() {
        return (websiteUrl == null || websiteUrl.isBlank()) ? null : websiteUrl;
    }

    public void setWebsiteUrl(String v) {
        this.websiteUrl = v;
    }

    public String getBackgroundColor2() {
        return (backgroundColor2 == null || backgroundColor2.isBlank()) ? null : backgroundColor2;
    }

    public void setBackgroundColor2(String v) {
        this.backgroundColor2 = v;
    }

    public String getOrderConfirmStyle() {
        return orDefault(orderConfirmStyle, "CHECK");
    }

    public void setOrderConfirmStyle(String v) {
        this.orderConfirmStyle = v;
    }

    /** null (alte Datensaetze) gilt als hell. */
    public boolean isDarkMode() {
        return darkMode != null && darkMode;
    }

    public void setDarkMode(boolean darkMode) {
        this.darkMode = darkMode;
    }

    public String getOpeningHours() {
        return (openingHours == null || openingHours.isBlank()) ? null : openingHours;
    }

    public void setOpeningHours(String v) {
        this.openingHours = v;
    }

    public String getAddress() {
        return (address == null || address.isBlank()) ? null : address;
    }

    public void setAddress(String v) {
        this.address = v;
    }

    public String getPhone() {
        return (phone == null || phone.isBlank()) ? null : phone;
    }

    public void setPhone(String v) {
        this.phone = v;
    }
}
