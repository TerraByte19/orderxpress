package com.orderxpress.web.dto;

import java.time.Instant;

/** Ein offener Kellner-Ruf in der Kasse-/Kellner-Ansicht. */
public record WaiterCallDto(Long id, int tableNumber, String guestName, Instant createdAt) {
}
