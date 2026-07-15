package com.orderxpress.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Ein Bild eines Ladens (Logo oder Hintergrund). Bewusst eine EIGENE Tabelle
 * (nicht als Spalte an Restaurant), damit die haeufigen Restaurant-Abfragen
 * nicht bei jedem Aufruf die Bilddaten mitschleppen. Pro Laden und Art gibt es
 * hoechstens ein Bild (Unique-Constraint restaurant_id + kind).
 */
@Entity
@Table(name = "restaurant_assets",
        uniqueConstraints = @UniqueConstraint(columnNames = {"restaurant_id", "kind"}))
public class RestaurantAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "restaurant_id", nullable = false)
    private Long restaurantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AssetKind kind;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Lob
    @Column(nullable = false)
    private byte[] data;

    protected RestaurantAsset() {
        // fuer JPA
    }

    public RestaurantAsset(Long restaurantId, AssetKind kind, String contentType, byte[] data) {
        this.restaurantId = restaurantId;
        this.kind = kind;
        this.contentType = contentType;
        this.data = data;
    }

    public void update(String contentType, byte[] data) {
        this.contentType = contentType;
        this.data = data;
    }

    public Long getId() {
        return id;
    }

    public Long getRestaurantId() {
        return restaurantId;
    }

    public AssetKind getKind() {
        return kind;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
