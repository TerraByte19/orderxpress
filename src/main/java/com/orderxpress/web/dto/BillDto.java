package com.orderxpress.web.dto;

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

    /** Eine einzelne Position (Bestell-Position) auf der Rechnung. */
    public record Line(Long orderItemId,
                       String name,
                       int quantity,
                       BigDecimal unitPrice,
                       BigDecimal lineTotal,
                       String note,
                       boolean paid) {
    }
}
