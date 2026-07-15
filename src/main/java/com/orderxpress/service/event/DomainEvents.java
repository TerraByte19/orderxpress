package com.orderxpress.service.event;

import com.orderxpress.domain.OrderStatus;
import com.orderxpress.domain.SessionStatus;

/**
 * Ereignisse, die NACH erfolgreichem Datenbank-Commit verarbeitet werden
 * (SSE-Benachrichtigungen an Inhaber/Kueche, Bondruck).
 */
public final class DomainEvents {

    private DomainEvents() {
    }

    /** Gast hat gescannt -> Inhaber sieht "Tisch Nr. X freigeben?". */
    public record SessionRequested(Long restaurantId, Long sessionId, int tableNumber, String message) {
    }

    /** Status einer Tisch-Sitzung hat sich geaendert (freigegeben, abgelehnt, ...). */
    public record SessionChanged(Long restaurantId, Long sessionId, int tableNumber, SessionStatus status) {
    }

    /** Neue Bestellung -> Kueche benachrichtigen und Bon drucken. */
    public record OrderCreated(Long restaurantId, Long orderId, int tableNumber) {
    }

    /** Bestellstatus hat sich geaendert (in Zubereitung, fertig, ...). */
    public record OrderStatusChanged(Long restaurantId, Long orderId, int tableNumber, OrderStatus status) {
    }
}
