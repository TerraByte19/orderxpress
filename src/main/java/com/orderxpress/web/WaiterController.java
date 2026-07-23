package com.orderxpress.web;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.service.BillingService;
import com.orderxpress.service.SseHub;
import com.orderxpress.web.dto.BillDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Kellner-Ansicht (nur lesen). Der Kellner meldet sich per QR-Code an (Geraet
 * mit Rolle WAITER) und sieht die Bestellungen pro Tisch - mit Zuordnung, wer
 * was bestellt hat. Kein Freigeben, kein Kassieren (das macht die Kasse).
 * Erreichbar fuer WAITER, SERVICE und OWNER.
 */
@RestController
@RequestMapping("/api/waiter")
public class WaiterController {

    private final BillingService billingService;
    private final SseHub sseHub;

    public WaiterController(BillingService billingService, SseHub sseHub) {
        this.billingService = billingService;
        this.sseHub = sseHub;
    }

    /** Alle belegten Tische mit ihren Positionen, nach Person gruppiert. */
    @GetMapping("/tables")
    public List<BillDto> tables() {
        return billingService.getActiveTables();
    }

    /** Live-Strom: neue Bestellungen/Statuswechsel (gleicher Kanal wie Kasse). */
    @GetMapping("/events")
    public SseEmitter events() {
        return sseHub.subscribeAdmin(CurrentUser.restaurantId());
    }
}
