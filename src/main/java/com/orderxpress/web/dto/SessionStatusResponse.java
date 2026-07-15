package com.orderxpress.web.dto;

import com.orderxpress.domain.SessionStatus;

/** Aktueller Zustand der Tisch-Sitzung aus Sicht des Gastes. */
public record SessionStatusResponse(SessionStatus status, int tableNumber) {
}
