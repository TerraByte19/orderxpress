package com.orderxpress.web.dto;

/**
 * Antwort auf den QR-Scan eines Geraets. Den deviceToken speichert das Geraet
 * dauerhaft und schickt ihn danach als Header "X-Device-Token" mit.
 */
public record DeviceActivationResponse(String deviceToken,
                                       String role,
                                       String label,
                                       Long restaurantId,
                                       String restaurantName) {
}
