package com.orderxpress.web.dto;

import com.orderxpress.domain.MenuItem;

import java.math.BigDecimal;

/** Gericht fuer die Inhaber-Verwaltung (inkl. Verfuegbarkeit, Kategorie und Bild). */
public record MenuItemAdminDto(Long id,
                               Long categoryId,
                               String categoryName,
                               String name,
                               String description,
                               String details,
                               BigDecimal price,
                               boolean available,
                               int sortOrder,
                               String imageUrl) {

    public static MenuItemAdminDto from(MenuItem item, boolean hasImage) {
        return new MenuItemAdminDto(
                item.getId(),
                item.getCategory().getId(),
                item.getCategory().getName(),
                item.getName(),
                item.getDescription(),
                item.getDetails(),
                item.getPrice(),
                item.isAvailable(),
                item.getSortOrder(),
                MenuItemDto.imageUrl(item.getId(), hasImage));
    }
}
