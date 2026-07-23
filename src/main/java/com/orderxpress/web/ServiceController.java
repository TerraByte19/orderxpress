package com.orderxpress.web;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.service.AdminCatalogService;
import com.orderxpress.service.BillingService;
import com.orderxpress.service.OrderService;
import com.orderxpress.service.SseHub;
import com.orderxpress.service.TableSessionService;
import com.orderxpress.web.dto.BillDto;
import com.orderxpress.web.dto.OrderResponse;
import com.orderxpress.web.dto.SessionDto;
import com.orderxpress.web.dto.SettleRequest;
import com.orderxpress.web.dto.TableDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Service-/Kassen-Ansicht (Kellner). Fuer Mitarbeiter, die vorne stehen, wenn
 * der Inhaber nicht im Laden ist: Tische freigeben ("Tisch Nr. X freigeben?"),
 * Sitzungen beenden und die laufenden Bestellungen im Blick behalten.
 * Erreichbar fuer Rolle SERVICE und OWNER. KEINE Verwaltung (Speisekarte/Design/Logins).
 */
@RestController
@RequestMapping("/api/service")
public class ServiceController {

    private final TableSessionService sessionService;
    private final AdminCatalogService catalogService;
    private final OrderService orderService;
    private final BillingService billingService;
    private final SseHub sseHub;

    public ServiceController(TableSessionService sessionService,
                             AdminCatalogService catalogService,
                             OrderService orderService,
                             BillingService billingService,
                             SseHub sseHub) {
        this.sessionService = sessionService;
        this.catalogService = catalogService;
        this.orderService = orderService;
        this.billingService = billingService;
        this.sseHub = sseHub;
    }

    // ---------- Tisch-Freigaben ----------

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

    // ---------- Tische + Bestellungen (nur ansehen) ----------

    @GetMapping("/tables")
    public List<TableDto> tables() {
        return catalogService.getTables();
    }

    @GetMapping("/orders")
    public List<OrderResponse> recentOrders() {
        return orderService.getRecentOrders();
    }

    // ---------- Kasse: geteilte Rechnung + bezahlen ----------

    /** Geteilte Rechnung eines Tisches (nach Person gruppiert, mit offen/bezahlt). */
    @GetMapping("/tables/{tableId}/bill")
    public BillDto tableBill(@PathVariable Long tableId) {
        return billingService.getBillForTable(tableId);
    }

    /** Ausgewaehlte Positionen als bezahlt markieren. */
    @PostMapping("/settle")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void settle(@Valid @RequestBody SettleRequest request) {
        billingService.settle(request.orderItemIds());
    }

    // ---------- Live-Ereignisse ----------

    /** Gleicher Live-Strom wie beim Inhaber (Freigabe-Anfragen, Bestellungen). */
    @GetMapping("/events")
    public SseEmitter events() {
        return sseHub.subscribeAdmin(CurrentUser.restaurantId());
    }
}
