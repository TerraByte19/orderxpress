package com.orderxpress.service.printing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Alles, was auf dem Kuechenbon steht - unabhaengig vom Druckertyp. */
public record ReceiptData(long orderId,
                          int tableNumber,
                          Instant createdAt,
                          List<Line> lines,
                          BigDecimal total) {

    public record Line(int quantity, String name, String note) {
    }
}
