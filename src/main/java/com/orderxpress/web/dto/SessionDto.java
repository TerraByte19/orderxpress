package com.orderxpress.web.dto;

import com.orderxpress.domain.SessionStatus;
import com.orderxpress.domain.TableSession;

import java.time.Instant;

/** Tisch-Sitzung fuer die Inhaber-Ansicht. */
public record SessionDto(Long id,
                         int tableNumber,
                         SessionStatus status,
                         Instant createdAt,
                         Instant approvedAt) {

    public static SessionDto from(TableSession session) {
        return new SessionDto(
                session.getId(),
                session.getRestaurantTable().getNumber(),
                session.getStatus(),
                session.getCreatedAt(),
                session.getApprovedAt());
    }
}
