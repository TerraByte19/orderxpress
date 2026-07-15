package com.orderxpress.web.dto;

/**
 * Design-Informationen eines Ladens fuer die Gaeste-Seite. logoUrl/backgroundUrl
 * sind null, wenn kein Bild hinterlegt ist.
 */
public record RestaurantThemeDto(Long id,
                                 String name,
                                 String accentColor,
                                 String backgroundColor,
                                 boolean categoriesAsHamburger,
                                 String logoUrl,
                                 String backgroundUrl) {
}
