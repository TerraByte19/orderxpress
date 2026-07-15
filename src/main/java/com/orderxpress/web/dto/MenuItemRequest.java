package com.orderxpress.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Gericht anlegen oder aendern. */
public record MenuItemRequest(@NotNull Long categoryId,
                              @NotBlank @Size(max = 150) String name,
                              @Size(max = 500) String description,
                              @Size(max = 2000) String details,
                              @NotNull @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal price,
                              Boolean available,
                              Integer sortOrder) {

    public boolean availableOrDefault() {
        return available == null || available;
    }

    public int sortOrderOrDefault() {
        return sortOrder == null ? 0 : sortOrder;
    }
}
