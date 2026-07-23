package com.orderxpress.service;

import com.orderxpress.config.AppProperties;
import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.Restaurant;
import com.orderxpress.domain.StaffDevice;
import com.orderxpress.domain.UserRole;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.repository.StaffDeviceRepository;
import com.orderxpress.web.dto.CreateDeviceRequest;
import com.orderxpress.web.dto.DeviceActivationResponse;
import com.orderxpress.web.dto.StaffDeviceDto;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Geraete-Anmeldung per QR-Code statt Mitarbeiter-Passwort.
 * Der Inhaber legt ein Geraet an -> QR-Code -> Geraet scannt einmal ->
 * ist danach dauerhaft angemeldet (Header "X-Device-Token").
 */
@Service
public class StaffDeviceService {

    private static final Logger log = LoggerFactory.getLogger(StaffDeviceService.class);

    /** lastUsedAt nicht bei jeder Anfrage schreiben - hoechstens einmal pro Minute. */
    private static final Duration TOUCH_INTERVAL = Duration.ofMinutes(1);

    private final StaffDeviceRepository deviceRepository;
    private final RestaurantRepository restaurantRepository;
    private final QrCodeService qrCodeService;
    private final AppProperties properties;

    public StaffDeviceService(StaffDeviceRepository deviceRepository,
                              RestaurantRepository restaurantRepository,
                              QrCodeService qrCodeService,
                              AppProperties properties) {
        this.deviceRepository = deviceRepository;
        this.restaurantRepository = restaurantRepository;
        this.qrCodeService = qrCodeService;
        this.properties = properties;
    }

    // ---------- Inhaber-Verwaltung ----------

    @Transactional(readOnly = true)
    public List<StaffDeviceDto> listDevices() {
        return deviceRepository.findByRestaurantIdOrderByCreatedAtAsc(CurrentUser.restaurantId())
                .stream()
                .map(d -> StaffDeviceDto.from(d, activationUrl(d)))
                .toList();
    }

    @Transactional
    public StaffDeviceDto createDevice(CreateDeviceRequest request) {
        if (request.role() == UserRole.OWNER) {
            throw new ConflictException("Ein Geraet kann nur Service oder Kueche sein, nicht Inhaber.");
        }
        Restaurant restaurant = restaurantRepository.getReferenceById(CurrentUser.restaurantId());
        StaffDevice device = deviceRepository.save(
                new StaffDevice(restaurant, request.label().trim(), request.role()));
        log.info("Neues Geraet '{}' ({}) fuer Laden {} angelegt",
                device.getLabel(), device.getRole(), CurrentUser.restaurantId());
        return StaffDeviceDto.from(device, activationUrl(device));
    }

    /** Neuen QR-Code erzeugen (Geraet neu einrichten / alter Code verloren). */
    @Transactional
    public StaffDeviceDto regenerate(Long id) {
        StaffDevice device = findOwn(id);
        device.regenerateActivationToken();
        return StaffDeviceDto.from(device, activationUrl(device));
    }

    /** Verlorenes Geraet sperren - der Token funktioniert sofort nicht mehr. */
    @Transactional
    public void revoke(Long id) {
        StaffDevice device = findOwn(id);
        device.revoke();
        log.info("Geraet '{}' gesperrt (Laden {})", device.getLabel(), CurrentUser.restaurantId());
    }

    /** QR-Code als PNG zum Anzeigen/Ausdrucken. */
    @Transactional(readOnly = true)
    public byte[] activationQrCode(Long id, int size) {
        StaffDevice device = findOwn(id);
        String url = activationUrl(device);
        if (url == null) {
            throw new ConflictException(
                    "Dieses Geraet ist bereits aktiviert. Erzeuge einen neuen QR-Code, um es neu einzurichten.");
        }
        return qrCodeService.generatePng(url, size);
    }

    // ---------- Aktivierung durch das Geraet (oeffentlich, einmalig) ----------

    @Transactional
    public DeviceActivationResponse activate(String activationToken) {
        StaffDevice device = deviceRepository.findByActivationTokenAndRevokedFalse(activationToken)
                .orElseThrow(() -> new NotFoundException(
                        "Dieser QR-Code ist ungueltig oder wurde bereits verwendet."));
        device.activate();
        log.info("Geraet '{}' aktiviert (Laden {})", device.getLabel(), device.getRestaurant().getId());
        return new DeviceActivationResponse(
                device.getDeviceToken(),
                device.getRole().name(),
                device.getLabel(),
                device.getRestaurant().getId(),
                device.getRestaurant().getName());
    }

    // ---------- Anmeldung bei jeder Anfrage (vom Filter benutzt) ----------

    /**
     * Loest den Geraetetoken auf. Aktualisiert "zuletzt aktiv" hoechstens
     * einmal pro Minute, damit nicht jede Anfrage schreibt.
     */
    @Transactional
    public Optional<StaffDevice> resolveDevice(String deviceToken) {
        Optional<StaffDevice> found = deviceRepository.findByDeviceTokenAndRevokedFalse(deviceToken);
        found.ifPresent(device -> {
            Instant last = device.getLastUsedAt();
            if (last == null || last.isBefore(Instant.now().minus(TOUCH_INTERVAL))) {
                device.touch();
            }
        });
        return found;
    }

    // ---------- Hilfsmethoden ----------

    private StaffDevice findOwn(Long id) {
        return deviceRepository.findByIdAndRestaurantId(id, CurrentUser.restaurantId())
                .orElseThrow(() -> new NotFoundException("Geraet %d nicht gefunden.".formatted(id)));
    }

    /** Link im QR-Code; null sobald das Geraet aktiviert (oder gesperrt) ist. */
    private String activationUrl(StaffDevice device) {
        if (device.getActivationToken() == null) {
            return null;
        }
        return baseUrl() + "/d/" + device.getActivationToken();
    }

    /**
     * Wie bei den Tisch-QR-Codes: steht in der Konfiguration nur "localhost",
     * nehmen wir die Adresse, ueber die der Inhaber die App gerade aufruft
     * (z.B. http://192.168.x.x:8080) - dann funktioniert der QR auch vom Tablet.
     */
    private String baseUrl() {
        String configured = properties.publicBaseUrl();
        boolean localhostDefault = configured == null || configured.isBlank()
                || configured.contains("localhost") || configured.contains("127.0.0.1");
        if (localhostDefault) {
            try {
                String fromRequest = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
                if (fromRequest != null && !fromRequest.isBlank()) {
                    configured = fromRequest;
                }
            } catch (IllegalStateException ignored) {
                // kein aktiver HTTP-Request (z.B. Test)
            }
        }
        if (configured != null && configured.endsWith("/")) {
            configured = configured.substring(0, configured.length() - 1);
        }
        return configured;
    }
}
