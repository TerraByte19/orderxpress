package com.orderxpress.web;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.OrderStatus;
import com.orderxpress.service.OrderService;
import com.orderxpress.service.SseHub;
import com.orderxpress.web.dto.OrderResponse;
import com.orderxpress.web.dto.StatusUpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * Kuechen-Ansicht: eingehende Bestellungen sehen, Status weiterschalten,
 * Bons nachdrucken. Erreichbar fuer Kueche und Inhaber.
 */
@RestController
@RequestMapping("/api/kitchen")
public class KitchenController {

    private final OrderService orderService;
    private final SseHub sseHub;

    public KitchenController(OrderService orderService, SseHub sseHub) {
        this.orderService = orderService;
        this.sseHub = sseHub;
    }

    /**
     * Offene Bestellungen (NEW, IN_PREPARATION, READY).
     * Mit ?status=... laesst sich gezielt filtern.
     */
    @GetMapping("/orders")
    public List<OrderResponse> orders(@RequestParam(required = false) OrderStatus status) {
        return orderService.getKitchenOrders(status);
    }

    /** Status weiterschalten, z.B. NEW -> IN_PREPARATION -> READY -> SERVED. */
    @PostMapping("/orders/{id}/status")
    public OrderResponse updateStatus(@PathVariable Long id,
                                      @Valid @RequestBody StatusUpdateRequest request) {
        return orderService.updateStatus(id, request.status());
    }

    /** Bon erneut drucken (Druck laeuft im Hintergrund). */
    @PostMapping("/orders/{id}/print")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void reprint(@PathVariable Long id) {
        orderService.requestReprint(id);
    }

    /** Live-Strom: neue Bestellungen und Statuswechsel des eigenen Ladens. */
    @GetMapping("/events")
    public SseEmitter events() {
        return sseHub.subscribeKitchen(CurrentUser.restaurantId());
    }
}
