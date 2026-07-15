package com.orderxpress.web.dto;

import com.orderxpress.domain.Restaurant;

import java.time.Instant;

/** Laden fuer die Plattform-Admin-Uebersicht. */
public record RestaurantDto(Long id,
                            String name,
                            String slug,
                            boolean active,
                            Instant createdAt) {

    public static RestaurantDto from(Restaurant r) {
        return new RestaurantDto(r.getId(), r.getName(), r.getSlug(), r.isActive(), r.getCreatedAt());
    }
}
