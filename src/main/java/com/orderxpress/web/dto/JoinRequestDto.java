package com.orderxpress.web.dto;

import com.orderxpress.domain.Guest;

import java.time.Instant;

/** Eine offene Beitritts-Anfrage, die der Gastgeber genehmigen/ablehnen kann. */
public record JoinRequestDto(Long id, String name, Instant createdAt) {

    public static JoinRequestDto from(Guest guest) {
        return new JoinRequestDto(guest.getId(), guest.getName(), guest.getCreatedAt());
    }
}
