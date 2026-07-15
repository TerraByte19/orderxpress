package com.orderxpress.web;

import com.orderxpress.domain.AssetKind;
import com.orderxpress.domain.MenuItemImage;
import com.orderxpress.domain.RestaurantAsset;
import com.orderxpress.service.MenuImageService;
import com.orderxpress.service.MenuService;
import com.orderxpress.service.OrderService;
import com.orderxpress.service.RestaurantAdminService;
import com.orderxpress.service.TableSessionService;
import com.orderxpress.web.dto.MenuCategoryDto;
import com.orderxpress.web.dto.OrderResponse;
import com.orderxpress.web.dto.PlaceOrderRequest;
import com.orderxpress.web.dto.RestaurantThemeDto;
import com.orderxpress.web.dto.ScanResponse;
import com.orderxpress.web.dto.SessionStatusResponse;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Endpunkte fuer Gaeste (ohne Login). Der Zugriff wird ueber die geheimen
 * QR-/Sitzungs-Tokens und die Freigabe durch den Inhaber abgesichert.
 * Speisekarte und Design werden je Laden (restaurantId) geliefert.
 */
@RestController
@RequestMapping("/api/guest")
public class GuestController {

    private final TableSessionService sessionService;
    private final MenuService menuService;
    private final OrderService orderService;
    private final MenuImageService imageService;
    private final RestaurantAdminService restaurantAdminService;

    public GuestController(TableSessionService sessionService,
                           MenuService menuService,
                           OrderService orderService,
                           MenuImageService imageService,
                           RestaurantAdminService restaurantAdminService) {
        this.sessionService = sessionService;
        this.menuService = menuService;
        this.orderService = orderService;
        this.imageService = imageService;
        this.restaurantAdminService = restaurantAdminService;
    }

    /** Gast hat den QR-Code am Tisch gescannt. */
    @PostMapping("/scan/{qrToken}")
    public ScanResponse scan(@PathVariable String qrToken) {
        return sessionService.scan(qrToken);
    }

    /** Gast fragt ab, ob der Tisch inzwischen freigegeben wurde. */
    @GetMapping("/sessions/{sessionToken}")
    public SessionStatusResponse sessionStatus(@PathVariable String sessionToken) {
        return sessionService.getStatus(sessionToken);
    }

    /** Design des Ladens (Farben, Logo, Hintergrund, Hamburger-Menue). */
    @GetMapping("/theme/{restaurantId}")
    public RestaurantThemeDto theme(@PathVariable Long restaurantId) {
        return restaurantAdminService.getPublicTheme(restaurantId);
    }

    /** Speisekarte eines Ladens (nur verfuegbare Gerichte). */
    @GetMapping("/menu/{restaurantId}")
    public List<MenuCategoryDto> menu(@PathVariable Long restaurantId) {
        return menuService.getGuestMenu(restaurantId);
    }

    /** Bestellung abschicken - geht an die Kueche und wird gedruckt. */
    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(@Valid @RequestBody PlaceOrderRequest request) {
        return orderService.placeOrder(request);
    }

    /** Bisherige Bestellungen der eigenen Tisch-Sitzung. */
    @GetMapping("/sessions/{sessionToken}/orders")
    public List<OrderResponse> myOrders(@PathVariable String sessionToken) {
        return orderService.getOrdersForSession(sessionToken);
    }

    /** Foto eines Gerichts (fuer die Speisekarte). */
    @GetMapping("/menu-items/{id}/image")
    public ResponseEntity<byte[]> menuItemImage(@PathVariable Long id) {
        MenuItemImage image = imageService.getImage(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)))
                .body(image.getData());
    }

    /** Logo eines Ladens. */
    @GetMapping("/restaurants/{restaurantId}/logo")
    public ResponseEntity<byte[]> logo(@PathVariable Long restaurantId) {
        return asset(restaurantId, AssetKind.LOGO);
    }

    /** Hintergrundbild eines Ladens. */
    @GetMapping("/restaurants/{restaurantId}/background")
    public ResponseEntity<byte[]> background(@PathVariable Long restaurantId) {
        return asset(restaurantId, AssetKind.BACKGROUND);
    }

    private ResponseEntity<byte[]> asset(Long restaurantId, AssetKind kind) {
        RestaurantAsset image = restaurantAdminService.getAsset(restaurantId, kind);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)))
                .body(image.getData());
    }
}
