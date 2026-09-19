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

    // ---------- Design: Struktur-Achsen ----------
    // Die vorherigen Achsen aendern Farbe, Schrift und Radius - das Skelett
    // der Gaeste-Seite blieb bei jedem Laden gleich. Diese sechs Spalten
    // aendern Aufbau und Rhythmus. Alle nullable, damit bestehende
    // Datenbanken ohne Reset auskommen; null/leer = bisheriges Verhalten.

    /** Aufbau der Speisekarte: LISTE (Zeile mit kleinem Foto, bisher) |
     *  KACHELN (zwei Spalten, grosses Foto) | TAFEL (reine Schrift ohne
     *  Fotos, fuer Bars/Baeckereien ohne Bildmaterial). null/leer = LISTE. */
    @Column(name = "menu_layout", length = 20)
    private String menuLayout;

    /** Kopf der Speisekarte: BAND (Foto-Streifen, bisher) | VOLL
     *  (bildschirmfuellender Auftakt) | SCHLICHT (nur der Ladenname gross
     *  gesetzt, kein Foto). null/leer = BAND. */
    @Column(name = "hero_style", length = 20)
    private String heroStyle;

    /** Textur des Seitenhintergrunds: KEIN | PAPIER | LINIEN | TERRAZZO.
     *  Reines CSS, Toenung folgt der errechneten Textfarbe. null/leer = KEIN. */
    @Column(name = "texture_style", length = 20)
    private String textureStyle;

    /** Optik aller Knoepfe und Pillen: FLACH (bisher) | RAHMEN (nur Kontur) |
     *  ERHOBEN (getragener Schatten). null/leer = FLACH. */
    @Column(name = "control_style", length = 20)
    private String controlStyle;

    /** Kategorien-Navigation: REITER | HAMBURGER | KAPITEL (keine Leiste,
     *  klebende Kapitel-Ueberschriften). null/leer wird aus dem aelteren
     *  Schalter categoriesAsHamburger abgeleitet - bestehende Laeden
     *  behalten dadurch ihre Einstellung ohne Datenwanderung. */
    @Column(name = "category_style", length = 20)
    private String categoryStyle;

    /** Eigene Farbe des Vorhangs als Hex. null/leer = die Akzentfarbe des
     *  Ladens (bisheriges Verhalten). Eigenes Feld, weil der Akzent eine
     *  KNOPF-Farbe ist: kleine Flaeche, hohe Saettigung. Bildschirmfuellend
     *  ist derselbe Ton oft zu hart - ein dunkelroter Vorhang zu orangen
     *  Knoepfen ist eine ganz normale Kombination. */
    @Column(name = "intro_color", length = 20)
    private String introColor;

    /** Logo auf dem Vorhang: OHNE | KLEIN | GROSS. Gemeint ist immer das
     *  bestehende Design-Logo, kein zweiter Upload-Platz. null/leer = KLEIN
     *  (bisheriges Verhalten: Logo erscheint, wenn eins hinterlegt ist). */
    @Column(name = "intro_logo", length = 20)
    private String introLogo;

    /** Wie lange der Vorhang mit Logo/Text anhaelt, bevor er aufgeht:
     *  OHNE | KURZ | NORMAL | LANG. null/leer = NORMAL (2 s, bisheriges
     *  Verhalten). Ohne Logo UND ohne Text gibt es nichts zu lesen, dann
     *  laeuft der Vorhang unabhaengig davon durch. */
    @Column(name = "intro_hold", length = 20)
    private String introHold;

    /** IMMER = bei jedem Seitenaufruf, EINMAL = nur beim ersten Mal auf
     *  diesem Geraet. null/leer = IMMER (Entscheidung vom 19.09.2026). */
    @Column(name = "intro_repeat", length = 20)
    private String introRepeat;

    /** Staerke aller Bewegungen: DEZENT | NORMAL | VERSPIELT. Skaliert im
     *  Frontend die Dauern und schaltet die verspielten Zugaben zu.
     *  prefers-reduced-motion schlaegt das weiterhin immer. null/leer = NORMAL. */
    @Column(name = "motion_level", length = 20)
    private String motionLevel;

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

    // ---------- Struktur-Achsen ----------

    public String getMenuLayout() {
        return orDefault(menuLayout, "LISTE");
    }

    public void setMenuLayout(String v) {
        this.menuLayout = v;
    }

    public String getHeroStyle() {
        return orDefault(heroStyle, "BAND");
    }

    public void setHeroStyle(String v) {
        this.heroStyle = v;
    }

    public String getTextureStyle() {
        return orDefault(textureStyle, "KEIN");
    }

    public void setTextureStyle(String v) {
        this.textureStyle = v;
    }

    public String getControlStyle() {
        return orDefault(controlStyle, "FLACH");
    }

    public void setControlStyle(String v) {
        this.controlStyle = v;
    }

    /**
     * Rueckfall auf den aelteren Schalter categoriesAsHamburger: ein Laden,
     * der vor dieser Achse "Kategorien als Hamburger" gesetzt hatte, bekommt
     * HAMBURGER - sonst REITER. Erst wenn die Achse selbst gesetzt ist,
     * fuehrt sie (updateDesign haelt beide Felder danach synchron).
     */
    public String getCategoryStyle() {
        if (categoryStyle == null || categoryStyle.isBlank()) {
            return categoriesAsHamburger ? "HAMBURGER" : "REITER";
        }
        return categoryStyle;
    }

    public void setCategoryStyle(String v) {
        this.categoryStyle = v;
    }

    public String getMotionLevel() {
        return orDefault(motionLevel, "NORMAL");
    }

    public void setMotionLevel(String v) {
        this.motionLevel = v;
    }

    // ---------- Vorhang: Feinheiten ----------

    /** null statt "" - leer bedeutet hier "keine eigene Farbe, nimm den
     *  Akzent", nicht "Standardwert" (gleiche Regel wie bei introText). */
    public String getIntroColor() {
        return (introColor == null || introColor.isBlank()) ? null : introColor;
    }

    public void setIntroColor(String v) {
        this.introColor = v;
    }

    public String getIntroLogo() {
        return orDefault(introLogo, "KLEIN");
    }

    public void setIntroLogo(String v) {
        this.introLogo = v;
    }

    public String getIntroHold() {
        return orDefault(introHold, "NORMAL");
    }

    public void setIntroHold(String v) {
        this.introHold = v;
    }

    public String getIntroRepeat() {
        return orDefault(introRepeat, "IMMER");
    }

    public void setIntroRepeat(String v) {
        this.introRepeat = v;
    }
}
