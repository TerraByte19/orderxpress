package com.orderxpress.service;

import com.orderxpress.service.event.DomainEvents;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Reagiert auf Domaenen-Ereignisse NACH erfolgreichem Datenbank-Commit.
 * So bekommen Inhaber/Kueche nie eine Benachrichtigung zu Daten,
 * die es (wegen Rollback) gar nicht gibt.
 */
@Component
public class DomainEventListener {

    private final SseHub sseHub;
    private final PrintService printService;

    public DomainEventListener(SseHub sseHub, PrintService printService) {
        this.sseHub = sseHub;
        this.printService = printService;
    }

    /** "Tisch Nr. X freigeben?" -> Live-Meldung an die Inhaber-Ansicht des Ladens. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSessionRequested(DomainEvents.SessionRequested event) {
        sseHub.notifyAdmins(event.restaurantId(), "session-requested", event);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSessionChanged(DomainEvents.SessionChanged event) {
        sseHub.notifyAdmins(event.restaurantId(), "session-changed", event);
    }

    /** Neue Bestellung -> Kueche + Inhaber des Ladens informieren und Bon drucken. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderCreated(DomainEvents.OrderCreated event) {
        sseHub.notifyKitchen(event.restaurantId(), "order-created", event);
        sseHub.notifyAdmins(event.restaurantId(), "order-created", event);
        printService.printOrder(event.orderId()); // laeuft asynchron
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderStatusChanged(DomainEvents.OrderStatusChanged event) {
        sseHub.notifyKitchen(event.restaurantId(), "order-status-changed", event);
        sseHub.notifyAdmins(event.restaurantId(), "order-status-changed", event);
    }
}
