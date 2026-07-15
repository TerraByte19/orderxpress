package com.orderxpress.service;

import com.orderxpress.domain.AppUser;
import com.orderxpress.domain.Restaurant;
import com.orderxpress.domain.UserRole;
import com.orderxpress.repository.AppUserRepository;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.web.dto.CreateRestaurantRequest;
import com.orderxpress.web.dto.RestaurantDto;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Plattform-Verwaltung durch den Plattform-Admin: Laeden anlegen, auflisten,
 * aktiv/inaktiv schalten und loeschen. Beim Anlegen entsteht gleich der erste
 * Inhaber-Login. Passwoerter werden nur als BCrypt-Hash gespeichert.
 */
@Service
public class PlatformService {

    private static final Logger log = LoggerFactory.getLogger(PlatformService.class);

    private final RestaurantRepository restaurantRepository;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public PlatformService(RestaurantRepository restaurantRepository,
                           AppUserRepository userRepository,
                           PasswordEncoder passwordEncoder) {
        this.restaurantRepository = restaurantRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<RestaurantDto> listRestaurants() {
        return restaurantRepository.findAllByOrderByNameAsc()
                .stream()
                .map(RestaurantDto::from)
                .toList();
    }

    @Transactional
    public RestaurantDto createRestaurant(CreateRestaurantRequest request) {
        String slug = request.slug().toLowerCase();
        if (restaurantRepository.existsBySlugIgnoreCase(slug)) {
            throw new ConflictException("Kurzkennung (slug) '%s' ist bereits vergeben.".formatted(slug));
        }
        if (restaurantRepository.existsByNameIgnoreCase(request.name())) {
            throw new ConflictException("Ein Laden mit dem Namen '%s' existiert bereits.".formatted(request.name()));
        }
        if (userRepository.existsByUsernameIgnoreCase(request.ownerUsername())) {
            throw new ConflictException("Benutzername '%s' ist bereits vergeben.".formatted(request.ownerUsername()));
        }

        Restaurant restaurant = restaurantRepository.save(new Restaurant(request.name(), slug));
        AppUser owner = new AppUser(
                request.ownerUsername(),
                passwordEncoder.encode(request.ownerPassword()),
                UserRole.OWNER,
                restaurant);
        userRepository.save(owner);
        log.info("Neuer Laden angelegt: {} (slug={}, Inhaber={})",
                restaurant.getName(), slug, owner.getUsername());
        return RestaurantDto.from(restaurant);
    }

    @Transactional
    public RestaurantDto setActive(Long restaurantId, boolean active) {
        Restaurant restaurant = findRestaurant(restaurantId);
        restaurant.setActive(active);
        return RestaurantDto.from(restaurant);
    }

    @Transactional
    public void deleteRestaurant(Long restaurantId) {
        Restaurant restaurant = findRestaurant(restaurantId);
        try {
            // Zuerst die Logins des Ladens entfernen, dann den Laden selbst.
            userRepository.deleteAll(
                    userRepository.findByRestaurantIdAndRoleOrderByUsernameAsc(restaurantId, UserRole.OWNER));
            userRepository.deleteAll(
                    userRepository.findByRestaurantIdAndRoleOrderByUsernameAsc(restaurantId, UserRole.KITCHEN));
            restaurantRepository.delete(restaurant);
            restaurantRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException(
                    "Laden '%s' hat bereits Daten (Tische/Bestellungen) und kann nicht geloescht werden. "
                            .formatted(restaurant.getName())
                            + "Stattdessen deaktivieren.");
        }
    }

    private Restaurant findRestaurant(Long id) {
        return restaurantRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Laden %d nicht gefunden.".formatted(id)));
    }
}
