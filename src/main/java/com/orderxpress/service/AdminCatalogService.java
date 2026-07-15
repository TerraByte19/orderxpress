package com.orderxpress.service;

import com.orderxpress.config.AppProperties;
import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.MenuCategory;
import com.orderxpress.domain.MenuItem;
import com.orderxpress.domain.Restaurant;
import com.orderxpress.domain.RestaurantTable;
import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;
import com.orderxpress.repository.MenuCategoryRepository;
import com.orderxpress.repository.MenuItemImageRepository;
import com.orderxpress.repository.MenuItemRepository;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.repository.RestaurantTableRepository;
import com.orderxpress.repository.TableSessionRepository;
import com.orderxpress.web.dto.CategoryDto;
import com.orderxpress.web.dto.CategoryRequest;
import com.orderxpress.web.dto.MenuItemAdminDto;
import com.orderxpress.web.dto.MenuItemRequest;
import com.orderxpress.web.dto.TableDto;
import com.orderxpress.web.dto.TableRequest;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Verwaltung von Tischen, Kategorien und Gerichten durch den Inhaber.
 * Alle Operationen sind auf den Laden (restaurantId) des angemeldeten
 * Inhabers beschraenkt - ein Inhaber sieht und aendert nie fremde Daten.
 */
@Service
public class AdminCatalogService {

    private final RestaurantRepository restaurantRepository;
    private final RestaurantTableRepository tableRepository;
    private final TableSessionRepository sessionRepository;
    private final MenuCategoryRepository categoryRepository;
    private final MenuItemRepository menuItemRepository;
    private final MenuItemImageRepository imageRepository;
    private final QrCodeService qrCodeService;
    private final AppProperties properties;

    public AdminCatalogService(RestaurantRepository restaurantRepository,
                               RestaurantTableRepository tableRepository,
                               TableSessionRepository sessionRepository,
                               MenuCategoryRepository categoryRepository,
                               MenuItemRepository menuItemRepository,
                               MenuItemImageRepository imageRepository,
                               QrCodeService qrCodeService,
                               AppProperties properties) {
        this.restaurantRepository = restaurantRepository;
        this.tableRepository = tableRepository;
        this.sessionRepository = sessionRepository;
        this.categoryRepository = categoryRepository;
        this.menuItemRepository = menuItemRepository;
        this.imageRepository = imageRepository;
        this.qrCodeService = qrCodeService;
        this.properties = properties;
    }

    // ---------- Tische ----------

    @Transactional(readOnly = true)
    public List<TableDto> getTables() {
        Long rid = CurrentUser.restaurantId();
        // Aktive Sitzung je Tisch in EINER Abfrage ermitteln statt pro Tisch einzeln
        Map<Long, Long> sessionIdByTableId = sessionRepository
                .findByStatusAndRestaurantTable_Restaurant_IdOrderByCreatedAtAsc(SessionStatus.APPROVED, rid)
                .stream()
                .collect(Collectors.toMap(
                        s -> s.getRestaurantTable().getId(),
                        TableSession::getId,
                        (first, second) -> first));

        return tableRepository.findByRestaurantIdOrderByNumberAsc(rid).stream()
                .map(table -> toDto(table, sessionIdByTableId.get(table.getId())))
                .toList();
    }

    @Transactional
    public TableDto createTable(TableRequest request) {
        Long rid = CurrentUser.restaurantId();
        if (tableRepository.existsByRestaurantIdAndNumber(rid, request.number())) {
            throw new ConflictException("Tischnummer %d existiert bereits.".formatted(request.number()));
        }
        Restaurant restaurant = restaurantRepository.getReferenceById(rid);
        RestaurantTable table = new RestaurantTable(restaurant, request.number(), request.name());
        table.setActive(request.activeOrDefault());
        tableRepository.save(table);
        return toDto(table, null);
    }

    @Transactional
    public TableDto updateTable(Long id, TableRequest request) {
        Long rid = CurrentUser.restaurantId();
        RestaurantTable table = findTable(id, rid);
        if (table.getNumber() != request.number()
                && tableRepository.existsByRestaurantIdAndNumber(rid, request.number())) {
            throw new ConflictException("Tischnummer %d existiert bereits.".formatted(request.number()));
        }
        table.setNumber(request.number());
        table.setName(request.name());
        table.setActive(request.activeOrDefault());
        return toDto(table, currentApprovedSessionId(table));
    }

    @Transactional
    public void deleteTable(Long id) {
        RestaurantTable table = findTable(id, CurrentUser.restaurantId());
        try {
            tableRepository.delete(table);
            tableRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException(
                    "Tisch %d hat bereits Sitzungen/Bestellungen und kann nicht geloescht werden. "
                            .formatted(table.getNumber())
                            + "Stattdessen deaktivieren (active=false).");
        }
    }

    /** Neuen QR-Token erzeugen - der alte QR-Code wird damit sofort ungueltig. */
    @Transactional
    public TableDto regenerateQrToken(Long id) {
        RestaurantTable table = findTable(id, CurrentUser.restaurantId());
        table.regenerateQrToken();
        return toDto(table, currentApprovedSessionId(table));
    }

    /** PNG des Tisch-QR-Codes zum Ausdrucken. */
    @Transactional(readOnly = true)
    public byte[] getTableQrCode(Long id, int size) {
        RestaurantTable table = findTable(id, CurrentUser.restaurantId());
        return qrCodeService.generatePng(qrUrl(table), size);
    }

    // ---------- Kategorien ----------

    @Transactional(readOnly = true)
    public List<CategoryDto> getCategories() {
        return categoryRepository.findByRestaurantIdOrderBySortOrderAscNameAsc(CurrentUser.restaurantId())
                .stream()
                .map(CategoryDto::from)
                .toList();
    }

    @Transactional
    public CategoryDto createCategory(CategoryRequest request) {
        Long rid = CurrentUser.restaurantId();
        if (categoryRepository.existsByRestaurantIdAndNameIgnoreCase(rid, request.name())) {
            throw new ConflictException("Kategorie '%s' existiert bereits.".formatted(request.name()));
        }
        Restaurant restaurant = restaurantRepository.getReferenceById(rid);
        MenuCategory category = new MenuCategory(restaurant, request.name(), request.sortOrderOrDefault());
        category.setActive(request.activeOrDefault());
        categoryRepository.save(category);
        return CategoryDto.from(category);
    }

    @Transactional
    public CategoryDto updateCategory(Long id, CategoryRequest request) {
        Long rid = CurrentUser.restaurantId();
        MenuCategory category = findCategory(id, rid);
        if (!category.getName().equalsIgnoreCase(request.name())
                && categoryRepository.existsByRestaurantIdAndNameIgnoreCase(rid, request.name())) {
            throw new ConflictException("Kategorie '%s' existiert bereits.".formatted(request.name()));
        }
        category.setName(request.name());
        category.setSortOrder(request.sortOrderOrDefault());
        category.setActive(request.activeOrDefault());
        return CategoryDto.from(category);
    }

    @Transactional
    public void deleteCategory(Long id) {
        MenuCategory category = findCategory(id, CurrentUser.restaurantId());
        if (menuItemRepository.existsByCategoryId(id)) {
            throw new ConflictException(
                    "Kategorie '%s' enthaelt noch Gerichte und kann nicht geloescht werden.".formatted(category.getName()));
        }
        categoryRepository.delete(category);
    }

    // ---------- Gerichte ----------

    @Transactional(readOnly = true)
    public List<MenuItemAdminDto> getMenuItems() {
        Set<Long> idsWithImage = Set.copyOf(imageRepository.findAllMenuItemIds());
        return menuItemRepository.findAdminMenu(CurrentUser.restaurantId())
                .stream()
                .map(item -> MenuItemAdminDto.from(item, idsWithImage.contains(item.getId())))
                .toList();
    }

    @Transactional
    public MenuItemAdminDto createMenuItem(MenuItemRequest request) {
        MenuCategory category = findCategory(request.categoryId(), CurrentUser.restaurantId());
        MenuItem item = new MenuItem(category, request.name(), request.description(),
                request.price(), request.sortOrderOrDefault());
        item.setDetails(request.details());
        item.setAvailable(request.availableOrDefault());
        menuItemRepository.save(item);
        return MenuItemAdminDto.from(item, false);
    }

    @Transactional
    public MenuItemAdminDto updateMenuItem(Long id, MenuItemRequest request) {
        Long rid = CurrentUser.restaurantId();
        MenuItem item = findMenuItem(id, rid);
        item.setCategory(findCategory(request.categoryId(), rid));
        item.setName(request.name());
        item.setDescription(request.description());
        item.setDetails(request.details());
        item.setPrice(request.price());
        item.setAvailable(request.availableOrDefault());
        item.setSortOrder(request.sortOrderOrDefault());
        return MenuItemAdminDto.from(item, imageRepository.existsById(id));
    }

    @Transactional
    public void deleteMenuItem(Long id) {
        MenuItem item = findMenuItem(id, CurrentUser.restaurantId());
        try {
            imageRepository.deleteById(id); // zugehoeriges Bild mit entfernen
            menuItemRepository.delete(item);
            menuItemRepository.flush();
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException(
                    "'%s' ist Teil bestehender Bestellungen und kann nicht geloescht werden. "
                            .formatted(item.getName())
                            + "Stattdessen auf 'available=false' setzen.");
        }
    }

    // ---------- Hilfsmethoden ----------

    private RestaurantTable findTable(Long id, Long restaurantId) {
        return tableRepository.findByIdAndRestaurantId(id, restaurantId)
                .orElseThrow(() -> new NotFoundException("Tisch %d nicht gefunden.".formatted(id)));
    }

    private MenuCategory findCategory(Long id, Long restaurantId) {
        return categoryRepository.findByIdAndRestaurantId(id, restaurantId)
                .orElseThrow(() -> new NotFoundException("Kategorie %d nicht gefunden.".formatted(id)));
    }

    private MenuItem findMenuItem(Long id, Long restaurantId) {
        return menuItemRepository.findByIdAndRestaurantId(id, restaurantId)
                .orElseThrow(() -> new NotFoundException("Gericht %d nicht gefunden.".formatted(id)));
    }

    /** Id der aktuell freigegebenen Sitzung dieses Tisches, sonst null. */
    private Long currentApprovedSessionId(RestaurantTable table) {
        return sessionRepository
                .findFirstByRestaurantTableIdAndStatus(table.getId(), SessionStatus.APPROVED)
                .map(TableSession::getId)
                .orElse(null);
    }

    private String qrUrl(RestaurantTable table) {
        return baseUrl() + "/t/" + table.getQrToken();
    }

    /**
     * Basis-URL fuer QR-Codes und Gast-Links. Ist in der Konfiguration nur der
     * Standard "localhost" eingetragen, nehmen wir stattdessen die Adresse, ueber
     * die der Inhaber die App gerade aufruft (z.B. http://192.168.x.x:8080). So
     * funktioniert der QR-Code automatisch auch vom Handy im selben WLAN, ohne
     * dass etwas konfiguriert werden muss. Ist eine echte Domain hinterlegt, wird
     * diese bevorzugt.
     */
    private String baseUrl() {
        String configured = properties.publicBaseUrl();
        boolean isLocalhostDefault = configured == null || configured.isBlank()
                || configured.contains("localhost") || configured.contains("127.0.0.1");
        if (isLocalhostDefault) {
            try {
                String fromRequest = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
                if (fromRequest != null && !fromRequest.isBlank()) {
                    configured = fromRequest;
                }
            } catch (IllegalStateException ignored) {
                // kein aktiver HTTP-Request (z.B. Test) -> konfigurierten Wert nehmen
            }
        }
        if (configured != null && configured.endsWith("/")) {
            configured = configured.substring(0, configured.length() - 1);
        }
        return configured;
    }

    private TableDto toDto(RestaurantTable table, Long currentSessionId) {
        return new TableDto(
                table.getId(),
                table.getNumber(),
                table.getName(),
                table.isActive(),
                currentSessionId != null,
                currentSessionId,
                table.getQrToken(),
                qrUrl(table));
    }
}
