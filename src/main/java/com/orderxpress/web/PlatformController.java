package com.orderxpress.web;

import com.orderxpress.service.PlatformService;
import com.orderxpress.web.dto.CreateRestaurantRequest;
import com.orderxpress.web.dto.RestaurantDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Plattform-Verwaltung: Laeden anlegen, auflisten, aktiv/inaktiv schalten,
 * loeschen. Nur mit dem Plattform-Admin-Login (application.yml) erreichbar.
 */
@RestController
@RequestMapping("/api/platform")
public class PlatformController {

    private final PlatformService platformService;

    public PlatformController(PlatformService platformService) {
        this.platformService = platformService;
    }

    @GetMapping("/restaurants")
    public List<RestaurantDto> restaurants() {
        return platformService.listRestaurants();
    }

    @PostMapping("/restaurants")
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantDto createRestaurant(@Valid @RequestBody CreateRestaurantRequest request) {
        return platformService.createRestaurant(request);
    }

    @PostMapping("/restaurants/{id}/active")
    public RestaurantDto setActive(@PathVariable Long id, @RequestParam boolean value) {
        return platformService.setActive(id, value);
    }

    @DeleteMapping("/restaurants/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRestaurant(@PathVariable Long id) {
        platformService.deleteRestaurant(id);
    }
}
