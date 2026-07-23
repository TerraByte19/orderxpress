package com.orderxpress.web;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.AssetKind;
import com.orderxpress.service.AdminCatalogService;
import com.orderxpress.service.MenuImageService;
import com.orderxpress.service.OrderService;
import com.orderxpress.service.RestaurantAdminService;
import com.orderxpress.service.SseHub;
import com.orderxpress.service.StaffDeviceService;
import com.orderxpress.service.TableSessionService;
import com.orderxpress.web.dto.CategoryDto;
import com.orderxpress.web.dto.CategoryRequest;
import com.orderxpress.web.dto.CreateDeviceRequest;
import com.orderxpress.web.dto.CreateUserRequest;
import com.orderxpress.web.dto.StaffDeviceDto;
import com.orderxpress.web.dto.DesignRequest;
import com.orderxpress.web.dto.StaffUserDto;
import com.orderxpress.web.dto.MenuItemAdminDto;
import com.orderxpress.web.dto.MenuItemRequest;
import com.orderxpress.web.dto.OrderResponse;
import com.orderxpress.web.dto.RestaurantThemeDto;
import com.orderxpress.web.dto.SessionDto;
import com.orderxpress.web.dto.TableDto;
import com.orderxpress.web.dto.TableRequest;
import com.orderxpress.web.dto.UpdateUserRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Inhaber-Ansicht: Tisch-Freigaben, Bestell-Uebersicht sowie Verwaltung
 * von Tischen, Kategorien und Speisekarte. Nur mit Inhaber-Login erreichbar.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final TableSessionService sessionService;
    private final OrderService orderService;
    private final AdminCatalogService catalogService;
    private final MenuImageService imageService;
    private final RestaurantAdminService restaurantAdminService;
    private final StaffDeviceService staffDeviceService;
    private final SseHub sseHub;

    public AdminController(TableSessionService sessionService,
                           OrderService orderService,
                           AdminCatalogService catalogService,
                           MenuImageService imageService,
                           RestaurantAdminService restaurantAdminService,
                           StaffDeviceService staffDeviceService,
                           SseHub sseHub) {
        this.sessionService = sessionService;
        this.orderService = orderService;
        this.catalogService = catalogService;
        this.imageService = imageService;
        this.restaurantAdminService = restaurantAdminService;
        this.staffDeviceService = staffDeviceService;
        this.sseHub = sseHub;
    }

    // ---------- Tisch-Freigaben ("Tisch Nr. X freigeben?") ----------

    @GetMapping("/sessions/pending")
    public List<SessionDto> pendingSessions() {
        return sessionService.getPendingSessions();
    }

    @PostMapping("/sessions/{id}/approve")
    public SessionDto approveSession(@PathVariable Long id) {
        return sessionService.approve(id);
    }

    @PostMapping("/sessions/{id}/reject")
    public SessionDto rejectSession(@PathVariable Long id) {
        return sessionService.reject(id);
    }

    @PostMapping("/sessions/{id}/close")
    public SessionDto closeSession(@PathVariable Long id) {
        return sessionService.close(id);
    }

    // ---------- Bestell-Uebersicht ----------

    @GetMapping("/orders")
    public List<OrderResponse> recentOrders() {
        return orderService.getRecentOrders();
    }

    // ---------- Live-Ereignisse (SSE) ----------

    /** Live-Strom: neue Freigabe-Anfragen, Bestellungen, Statuswechsel des eigenen Ladens. */
    @GetMapping("/events")
    public SseEmitter events() {
        return sseHub.subscribeAdmin(CurrentUser.restaurantId());
    }

    // ---------- Tische ----------

    @GetMapping("/tables")
    public List<TableDto> tables() {
        return catalogService.getTables();
    }

    @PostMapping("/tables")
    @ResponseStatus(HttpStatus.CREATED)
    public TableDto createTable(@Valid @RequestBody TableRequest request) {
        return catalogService.createTable(request);
    }

    @PutMapping("/tables/{id}")
    public TableDto updateTable(@PathVariable Long id, @Valid @RequestBody TableRequest request) {
        return catalogService.updateTable(id, request);
    }

    @DeleteMapping("/tables/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTable(@PathVariable Long id) {
        catalogService.deleteTable(id);
    }

    @PostMapping("/tables/{id}/regenerate-qr")
    public TableDto regenerateQr(@PathVariable Long id) {
        return catalogService.regenerateQrToken(id);
    }

    /** QR-Code des Tisches als PNG (zum Ausdrucken). */
    @GetMapping(value = "/tables/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] tableQrCode(@PathVariable Long id,
                              @RequestParam(defaultValue = "384") int size) {
        int clamped = Math.max(128, Math.min(1024, size));
        return catalogService.getTableQrCode(id, clamped);
    }

    // ---------- Kategorien ----------

    @GetMapping("/categories")
    public List<CategoryDto> categories() {
        return catalogService.getCategories();
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryDto createCategory(@Valid @RequestBody CategoryRequest request) {
        return catalogService.createCategory(request);
    }

    @PutMapping("/categories/{id}")
    public CategoryDto updateCategory(@PathVariable Long id, @Valid @RequestBody CategoryRequest request) {
        return catalogService.updateCategory(id, request);
    }

    @DeleteMapping("/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable Long id) {
        catalogService.deleteCategory(id);
    }

    // ---------- Gerichte ----------

    @GetMapping("/menu-items")
    public List<MenuItemAdminDto> menuItems() {
        return catalogService.getMenuItems();
    }

    @PostMapping("/menu-items")
    @ResponseStatus(HttpStatus.CREATED)
    public MenuItemAdminDto createMenuItem(@Valid @RequestBody MenuItemRequest request) {
        return catalogService.createMenuItem(request);
    }

    @PutMapping("/menu-items/{id}")
    public MenuItemAdminDto updateMenuItem(@PathVariable Long id, @Valid @RequestBody MenuItemRequest request) {
        return catalogService.updateMenuItem(id, request);
    }

    @DeleteMapping("/menu-items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenuItem(@PathVariable Long id) {
        catalogService.deleteMenuItem(id);
    }

    // ---------- Gerichte-Fotos ----------

    /** Foto hochladen (JPG/PNG, max. 5 MB - wird serverseitig verkleinert). */
    @PostMapping(value = "/menu-items/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uploadMenuItemImage(@PathVariable Long id,
                                    @RequestParam("file") MultipartFile file) {
        imageService.saveImage(id, file);
    }

    @DeleteMapping("/menu-items/{id}/image")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMenuItemImage(@PathVariable Long id) {
        imageService.deleteImage(id);
    }

    // ---------- Design (Farben, Hamburger-Menue, Logo, Hintergrund) ----------

    @GetMapping("/design")
    public RestaurantThemeDto design() {
        return restaurantAdminService.getDesign();
    }

    @PutMapping("/design")
    public RestaurantThemeDto updateDesign(@Valid @RequestBody DesignRequest request) {
        return restaurantAdminService.updateDesign(request);
    }

    /** Logo hochladen (JPG/PNG, max. 5 MB - wird serverseitig verkleinert). */
    @PostMapping(value = "/design/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uploadLogo(@RequestParam("file") MultipartFile file) {
        restaurantAdminService.saveAsset(AssetKind.LOGO, file);
    }

    @DeleteMapping("/design/logo")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLogo() {
        restaurantAdminService.deleteAsset(AssetKind.LOGO);
    }

    /** Hintergrundbild hochladen (JPG/PNG, max. 5 MB - wird serverseitig verkleinert). */
    @PostMapping(value = "/design/background", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void uploadBackground(@RequestParam("file") MultipartFile file) {
        restaurantAdminService.saveAsset(AssetKind.BACKGROUND, file);
    }

    @DeleteMapping("/design/background")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBackground() {
        restaurantAdminService.deleteAsset(AssetKind.BACKGROUND);
    }

    // ---------- Mitarbeiter-Logins (Kueche + Service; der Inhaber legt sie selbst an) ----------

    @GetMapping("/users")
    public List<StaffUserDto> users() {
        return restaurantAdminService.listStaffUsers();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public StaffUserDto createUser(@Valid @RequestBody CreateUserRequest request) {
        return restaurantAdminService.createStaffUser(request);
    }

    @PutMapping("/users/{id}")
    public StaffUserDto updateUser(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return restaurantAdminService.updateStaffUser(id, request);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Long id) {
        restaurantAdminService.deleteStaffUser(id);
    }

    // ---------- Geraete (QR-Anmeldung statt Passwort) ----------

    @GetMapping("/devices")
    public List<StaffDeviceDto> devices() {
        return staffDeviceService.listDevices();
    }

    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.CREATED)
    public StaffDeviceDto createDevice(@Valid @RequestBody CreateDeviceRequest request) {
        return staffDeviceService.createDevice(request);
    }

    /** Neuen QR-Code erzeugen (Geraet neu einrichten). */
    @PostMapping("/devices/{id}/regenerate")
    public StaffDeviceDto regenerateDevice(@PathVariable Long id) {
        return staffDeviceService.regenerate(id);
    }

    /** QR-Code des Geraets als PNG zum Anzeigen/Ausdrucken. */
    @GetMapping(value = "/devices/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] deviceQrCode(@PathVariable Long id,
                               @RequestParam(defaultValue = "384") int size) {
        int clamped = Math.max(128, Math.min(1024, size));
        return staffDeviceService.activationQrCode(id, clamped);
    }

    /** Verlorenes Geraet sperren. */
    @DeleteMapping("/devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revokeDevice(@PathVariable Long id) {
        staffDeviceService.revoke(id);
    }
}
