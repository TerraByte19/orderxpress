package com.orderxpress.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/**
 * Ein Ambiente-/Stimmungsfoto eines Ladens (Bildergalerie auf der Gaeste-Seite,
 * getrennt von Gericht-Fotos). Eigene Tabelle wie {@link RestaurantAsset} -
 * beliebig viele Bilder pro Laden, Reihenfolge = Anlegereihenfolge (id aufsteigend).
 */
@Entity
@Table(name = "restaurant_gallery_images")
public class RestaurantGalleryImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "restaurant_id", nullable = false)
    private Long restaurantId;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Lob
    @Column(nullable = false)
    private byte[] data;

    protected RestaurantGalleryImage() {
        // fuer JPA
    }

    public RestaurantGalleryImage(Long restaurantId, String contentType, byte[] data) {
        this.restaurantId = restaurantId;
        this.contentType = contentType;
        this.data = data;
    }

    public Long getId() {
        return id;
    }

    public Long getRestaurantId() {
        return restaurantId;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
