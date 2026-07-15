package com.orderxpress.web.dto;

import java.util.List;

/** Eine Kategorie der Gaeste-Karte inkl. ihrer Gerichte. */
public record MenuCategoryDto(Long id, String name, List<MenuItemDto> items) {
}
