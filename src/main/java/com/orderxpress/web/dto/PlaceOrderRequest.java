package com.orderxpress.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Bestellung, die ein Gast abschickt. */
public record PlaceOrderRequest(
        @NotBlank String sessionToken,
        @NotEmpty @Valid List<OrderItemRequest> items) {

    /** Eine Position der Bestellung. */
    public record OrderItemRequest(
            @NotNull Long menuItemId,
            @Min(1) @Max(50) int quantity,
            @Size(max = 200) String note) {
    }
}
