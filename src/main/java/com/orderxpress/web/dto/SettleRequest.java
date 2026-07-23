package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Kasse: die ausgewaehlten Positionen (Bestell-Position-Ids) als bezahlt markieren. */
public record SettleRequest(@NotEmpty List<Long> orderItemIds) {
}
