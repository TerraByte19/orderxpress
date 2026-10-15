package com.orderxpress.web.dto;

import com.orderxpress.domain.OrderStatus;

import java.math.BigDecimal;
import java.util.List;

/**
 * Geteilte Rechnung eines Tisches: alle Positionen, nach Person gruppiert, mit
 * Summen und Bezahlt-Status. Grundlage fuer "Rechnung teilen" (Gast) und die
 * Kasse (Personal).
 */
public record BillDto(int tableNumber,
                      Long sessionId,
                      List<Participant> participants,
                      BigDecimal grandTotal,
                      BigDecimal paidTotal,
                      BigDecimal openTotal) {

    /** Eine Person mit ihren Positionen. */
    public record Participant(Long guestId,
                              String name,
                              boolean isHost,
                              List<Line> items,
                              BigDecimal total,
                              BigDecimal paidTotal,
                              BigDecimal openTotal) {
    }

    /**
     * Eine einzelne Position (Bestell-Position) auf der Rechnung.
     * paid = komplett bezahlt; paidQuantity/paidTotal = schon bezahlter Teil
     * (z.B. 2 von 5 Cola). orderId/orderStatus: zu welcher Bestellung die
     * Position gehoert (Kellner storniert Bestellungen im Status NEW).
     */
    public record Line(Long orderItemId,
                       String name,
                       int quantity,
                       BigDecimal unitPrice,
                       BigDecimal lineTotal,
                       String note,
                       boolean paid,
                       int paidQuantity,
                       BigDecimal paidTotal,
                       Long orderId,
                       OrderStatus orderStatus) {
    }
}
