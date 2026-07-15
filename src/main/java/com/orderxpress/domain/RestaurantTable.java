package com.orderxpress.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

/**
 * Ein Tisch in einem Restaurant. Der QR-Code auf dem Tisch enthaelt den geheimen
 * qrToken (nicht die Tischnummer!), damit niemand fremde Tische erraten kann.
 * Die Tischnummer ist nur INNERHALB eines Ladens eindeutig (mehrere Laeden
 * duerfen jeweils einen "Tisch 1" haben); der qrToken ist plattformweit eindeutig.
 */
@Entity
@Table(name = "restaurant_tables",
        uniqueConstraints = @UniqueConstraint(columnNames = {"restaurant_id", "table_number"}))
public class RestaurantTable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    /** Sichtbare Tischnummer, z.B. "Tisch 5" (eindeutig je Restaurant). */
    @Column(name = "table_number", nullable = false)
    private int number;

    /** Optionaler Name, z.B. "Terrasse links". */
    @Column(length = 100)
    private String name;

    /** Geheimer Token im QR-Code. Kann neu erzeugt werden, um alte QR-Codes ungueltig zu machen. */
    @Column(name = "qr_token", nullable = false, unique = true, length = 36)
    private String qrToken;

    @Column(nullable = false)
    private boolean active = true;

    protected RestaurantTable() {
        // fuer JPA
    }

    public RestaurantTable(Restaurant restaurant, int number, String name) {
        this.restaurant = restaurant;
        this.number = number;
        this.name = name;
        this.qrToken = UUID.randomUUID().toString();
    }

    public void regenerateQrToken() {
        this.qrToken = UUID.randomUUID().toString();
    }

    public Long getId() {
        return id;
    }

    public Restaurant getRestaurant() {
        return restaurant;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getQrToken() {
        return qrToken;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
