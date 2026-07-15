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

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

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
}
