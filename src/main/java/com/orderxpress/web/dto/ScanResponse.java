package com.orderxpress.web.dto;

import com.orderxpress.domain.GuestStatus;
import com.orderxpress.domain.SessionStatus;

/**
 * Antwort auf einen QR-Scan. Jede Person bekommt ihren eigenen guestToken, mit
 * dem sie ihren Status abfragt und bestellt.
 * - isHost: true = erste Person (Gastgeber), gibt weitere Personen frei.
 * - sessionStatus: Status des Tisches (PENDING = wartet auf Laden-Freigabe, APPROVED = offen).
 * - guestStatus: Status dieser Person (PENDING = wartet auf Freigabe, APPROVED = darf bestellen).
 */
public record ScanResponse(String guestToken,
                           boolean isHost,
                           SessionStatus sessionStatus,
                           GuestStatus guestStatus,
                           String guestName,
                           int tableNumber,
                           Long restaurantId,
                           String restaurantName) {
}
