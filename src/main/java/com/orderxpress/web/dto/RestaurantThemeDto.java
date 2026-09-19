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
                                 boolean kitchenDisplayEnabled,
                                 String logoUrl,
                                 String backgroundUrl,
                                 String styleShape,
                                 String displayFont,
                                 String cartFlyStyle,
                                 String orderConfirmStyle,
                                 boolean darkMode,
                                 String introStyle,
                                 String introText,
                                 String instagramUrl,
                                 String facebookUrl,
                                 String websiteUrl,
                                 String backgroundColor2,
                                 String introSpeed,
                                 String openingHours,
                                 String address,
                                 String phone,
                                 String menuLayout,
                                 String heroStyle,
                                 String textureStyle,
                                 String controlStyle,
                                 String categoryStyle,
                                 String motionLevel,
                                 String introColor,
                                 String introLogo,
                                 String introHold,
                                 String introRepeat) {
}
