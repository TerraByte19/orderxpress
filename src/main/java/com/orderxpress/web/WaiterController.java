package com.orderxpress.web;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.service.BillingService;
import com.orderxpress.service.SseHub;
import com.orderxpress.web.dto.BillDto;
import com.orderxpress.web.dto.SettleRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Kellner-Ansicht. Der Kellner meldet sich per QR-Code an (Geraet mit Rolle
 * WAITER) und sieht die Bestellungen pro Tisch - mit Zuordnung, wer was bestellt
 * hat. Er darf ausserdem abrechnen (Positionen als bezahlt markieren), aber
 * keine Tische freigeben und nichts verwalten. Erreichbar fuer WAITER, SERVICE
 * und OWNER.
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

    /** Abrechnen: ausgewaehlte Positionen als bezahlt markieren (Split moeglich). */
    @PostMapping("/settle")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void settle(@Valid @RequestBody SettleRequest request) {
        billingService.settle(request.orderItemIds());
    }

    /** Live-Strom: neue Bestellungen/Statuswechsel (gleicher Kanal wie Kasse). */
    @GetMapping("/events")
    public SseEmitter events() {
        return sseHub.subscribeAdmin(CurrentUser.restaurantId());
    }
}
