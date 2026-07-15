package com.orderxpress.web.dto;

import com.orderxpress.domain.OrderStatus;
import jakarta.validation.constraints.NotNull;

/** Neuer Status fuer eine Bestellung (Kuechen-Ansicht). */
public record StatusUpdateRequest(@NotNull OrderStatus status) {
}
