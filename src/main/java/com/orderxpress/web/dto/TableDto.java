package com.orderxpress.web.dto;

/** Tisch fuer die Inhaber-Verwaltung. */
public record TableDto(Long id,
                       int number,
                       String name,
                       boolean active,
                       boolean occupied,
                       Long currentSessionId,
                       String qrToken,
                       String qrUrl) {
}
