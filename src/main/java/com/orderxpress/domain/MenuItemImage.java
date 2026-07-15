package com.orderxpress.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/**
 * Foto zu einem Gericht. Bewusst eine EIGENE Tabelle (nicht als Spalte an
 * MenuItem), damit die Speisekarten-Abfragen nicht bei jedem Aufruf die
 * Bilddaten mitschleppen. Die Id ist identisch mit der Id des Gerichts.
 */
@Entity
@Table(name = "menu_item_images")
public class MenuItemImage {

    @Id
    @Column(name = "menu_item_id")
    private Long menuItemId;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Lob
    @Column(nullable = false)
    private byte[] data;

    protected MenuItemImage() {
        // fuer JPA
    }

    public MenuItemImage(Long menuItemId, String contentType, byte[] data) {
        this.menuItemId = menuItemId;
        this.contentType = contentType;
        this.data = data;
    }

    public void update(String contentType, byte[] data) {
        this.contentType = contentType;
        this.data = data;
    }

    public Long getMenuItemId() {
        return menuItemId;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
