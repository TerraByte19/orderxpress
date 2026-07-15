package com.orderxpress.web.dto;

import com.orderxpress.domain.SessionStatus;

/**
 * Antwort auf einen QR-Scan. Mit dem sessionToken fragt der Gast den Status ab
 * und bestellt. restaurantId/restaurantName braucht die Gaeste-Seite, um Design
 * (Farben/Logo/Hintergrund) und Speisekarte des richtigen Ladens zu laden.
 */
public record ScanResponse(String sessionToken,
                           SessionStatus status,
                           int tableNumber,
                           Long restaurantId,
                           String restaurantName) {
}
