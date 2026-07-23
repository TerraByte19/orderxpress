package com.orderxpress.web;

import com.orderxpress.domain.AssetKind;
import com.orderxpress.domain.MenuItemImage;
import com.orderxpress.domain.RestaurantAsset;
import com.orderxpress.service.BillingService;
import com.orderxpress.service.GuestService;
import com.orderxpress.service.MenuImageService;
import com.orderxpress.service.MenuService;
import com.orderxpress.service.OrderService;
import com.orderxpress.service.RestaurantAdminService;
import com.orderxpress.service.TableSessionService;
import com.orderxpress.web.dto.BillDto;
import com.orderxpress.web.dto.GuestStatusResponse;
import com.orderxpress.web.dto.JoinRequestDto;
import com.orderxpress.web.dto.MenuCategoryDto;
import com.orderxpress.web.dto.OrderResponse;
import com.orderxpress.web.dto.PlaceOrderRequest;
import com.orderxpress.web.dto.RenameRequest;
import com.orderxpress.web.dto.RestaurantThemeDto;
import com.orderxpress.web.dto.ScanResponse;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Endpunkte fuer Gaeste (ohne Login). Jede Person hat ihren eigenen guestToken.
 * Der Zugriff wird ueber die geheimen QR-/Gast-Tokens, die Laden-Freigabe (erste
 * Person) und die Gastgeber-Freigabe (weitere Personen) abgesichert.
 */
@RestController
@RequestMapping("/api/guest")
public class GuestController {

    private final TableSessionService sessionService;
    private final GuestService guestService;
    private final MenuService menuService;
    private final OrderService orderService;
    private final BillingService billingService;
    private final MenuImageService imageService;
    private final RestaurantAdminService restaurantAdminService;

    public GuestController(TableSessionService sessionService,
                           GuestService guestService,
                           MenuService menuService,
                           OrderService orderService,
                           BillingService billingService,
                           MenuImageService imageService,
                           RestaurantAdminService restaurantAdminService) {
        this.sessionService = sessionService;
        this.guestService = guestService;
        this.menuService = menuService;
        this.orderService = orderService;
        this.billingService = billingService;
        this.imageService = imageService;
        this.restaurantAdminService = restaurantAdminService;
    }

    /** Gast hat den QR-Code am Tisch gescannt (erzeugt eine neue Person am Tisch). */
    @PostMapping("/scan/{qrToken}")
    public ScanResponse scan(@PathVariable String qrToken) {
        return sessionService.scan(qrToken);
    }

    /** Gast fragt seinen eigenen Status ab (wartet auf Freigabe? darf bestellen?). */
    @GetMapping("/guests/{guestToken}")
    public GuestStatusResponse guestStatus(@PathVariable String guestToken) {
        return guestService.getStatus(guestToken);
    }

    /** Gast aendert seinen Anzeigenamen. */
    @PutMapping("/guests/{guestToken}/name")
    public GuestStatusResponse rename(@PathVariable String guestToken,
                                      @Valid @RequestBody RenameRequest request) {
        return guestService.rename(guestToken, request.name());
    }

    /** Offene Beitritts-Anfragen (nur fuer den Gastgeber sichtbar). */
    @GetMapping("/guests/{guestToken}/join-requests")
    public List<JoinRequestDto> joinRequests(@PathVariable String guestToken) {
        return guestService.listJoinRequests(guestToken);
    }

    /** Gastgeber gibt eine weitere Person frei. */
    @PostMapping("/guests/{guestToken}/join-requests/{joinerId}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void approveJoin(@PathVariable String guestToken, @PathVariable Long joinerId) {
        guestService.approveJoin(guestToken, joinerId);
    }

    /** Gastgeber lehnt eine weitere Person ab. */
    @PostMapping("/guests/{guestToken}/join-requests/{joinerId}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void rejectJoin(@PathVariable String guestToken, @PathVariable Long joinerId) {
        guestService.rejectJoin(guestToken, joinerId);
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

    /** Eigene Bestellungen dieser Person. */
    @GetMapping("/guests/{guestToken}/orders")
    public List<OrderResponse> myOrders(@PathVariable String guestToken) {
        return orderService.getOrdersForGuest(guestToken);
    }

    /** Geteilte Rechnung des ganzen Tisches (nach Person gruppiert). */
    @GetMapping("/guests/{guestToken}/bill")
    public BillDto bill(@PathVariable String guestToken) {
        return billingService.getBillForGuest(guestToken);
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
