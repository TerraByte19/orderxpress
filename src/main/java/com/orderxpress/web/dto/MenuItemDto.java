package com.orderxpress.web.dto;

import com.orderxpress.domain.MenuItem;
import com.orderxpress.domain.MenuItemBadge;

import java.math.BigDecimal;
import java.util.Set;
import java.util.stream.Collectors;

/** Ein bestellbares Gericht in der Gaeste-Karte. */
public record MenuItemDto(Long id, String name, String description, String details,
                          BigDecimal price, String imageUrl, Set<String> badges) {

    public static MenuItemDto from(MenuItem item, boolean hasImage) {
        return new MenuItemDto(
                item.getId(),
                item.getName(),
                item.getDescription(),
                item.getDetails(),
                item.getPrice(),
                imageUrl(item.getId(), hasImage),
                badgeNames(item.getBadges()));
    }

    static Set<String> badgeNames(Set<MenuItemBadge> badges) {
        return badges.stream().map(Enum::name).collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    static String imageUrl(Long itemId, boolean hasImage) {
        return hasImage ? "/api/guest/menu-items/%d/image".formatted(itemId) : null;
    }
}
