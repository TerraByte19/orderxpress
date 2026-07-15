package com.orderxpress.domain;

/**
 * Lebenszyklus einer Tisch-Sitzung:
 * PENDING  -> Gast hat den QR-Code gescannt, Inhaber muss den Tisch freigeben
 * APPROVED -> Tisch ist freigegeben, Gast darf bestellen
 * REJECTED -> Inhaber hat die Anfrage abgelehnt
 * EXPIRED  -> Anfrage wurde nicht rechtzeitig beantwortet
 * CLOSED   -> Sitzung beendet (Gaeste sind gegangen / haben bezahlt)
 */
public enum SessionStatus {
    PENDING, APPROVED, REJECTED, EXPIRED, CLOSED
}
