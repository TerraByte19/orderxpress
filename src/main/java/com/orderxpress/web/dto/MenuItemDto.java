package com.orderxpress.web.dto;

import com.orderxpress.domain.MenuItem;

import java.math.BigDecimal;

/** Ein bestellbares Gericht in der Gaeste-Karte. */
public record MenuItemDto(Long id, String name, String description, String details,
                          BigDecimal price, String imageUrl) {

    public static MenuItemDto from(MenuItem item, boolean hasImage) {
        return new MenuItemDto(
                item.getId(),
                item.getName(),
                item.getDescription(),
                item.getDetails(),
                item.getPrice(),
                imageUrl(item.getId(), hasImage));
    }

    static String imageUrl(Long itemId, boolean hasImage) {
        return hasImage ? "/api/guest/menu-items/%d/image".formatted(itemId) : null;
    }
}
