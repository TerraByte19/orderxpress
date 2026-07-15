package com.orderxpress.web.dto;

import com.orderxpress.domain.MenuCategory;

/** Kategorie fuer die Inhaber-Verwaltung. */
public record CategoryDto(Long id, String name, int sortOrder, boolean active) {

    public static CategoryDto from(MenuCategory category) {
        return new CategoryDto(category.getId(), category.getName(), category.getSortOrder(), category.isActive());
    }
}
