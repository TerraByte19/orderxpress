package com.orderxpress.web;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.config.security.StoreUserDetails;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.web.dto.MeResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Wer bin ich?" - liefert Rolle und Laden des angemeldeten Benutzers bzw.
 * Geraets. Das Frontend baut damit die Navigation auf: der Inhaber sieht alle
 * Ansichten, Service nur Service, Kueche nur Kueche.
 */
@RestController
@RequestMapping("/api/me")
public class MeController {

    private final RestaurantRepository restaurantRepository;

    public MeController(RestaurantRepository restaurantRepository) {
        this.restaurantRepository = restaurantRepository;
    }

    @GetMapping
    public MeResponse me() {
        StoreUserDetails details = CurrentUser.details();
        Long restaurantId = details.getRestaurantId();
        String restaurantName = restaurantRepository.findById(restaurantId)
                .map(r -> r.getName())
                .orElse("");
        return new MeResponse(details.getUsername(), details.getRole(), restaurantId, restaurantName);
    }
}
