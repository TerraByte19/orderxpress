package com.orderxpress.web.dto;

import com.orderxpress.domain.StaffDevice;

import java.time.Instant;

/**
 * Geraet in der Inhaber-Verwaltung. activationUrl ist nur gesetzt, solange das
 * Geraet noch NICHT aktiviert wurde (danach ist der Einmal-Token verbraucht).
 */
public record StaffDeviceDto(Long id,
                             String label,
                             String role,
                             boolean activated,
                             boolean revoked,
                             Instant createdAt,
                             Instant lastUsedAt,
                             String activationUrl) {

    public static StaffDeviceDto from(StaffDevice d, String activationUrl) {
        return new StaffDeviceDto(
                d.getId(), d.getLabel(), d.getRole().name(),
                d.isActivated(), d.isRevoked(),
                d.getCreatedAt(), d.getLastUsedAt(), activationUrl);
    }
}
