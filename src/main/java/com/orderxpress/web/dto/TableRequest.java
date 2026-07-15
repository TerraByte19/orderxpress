package com.orderxpress.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Tisch anlegen oder aendern. "active" ist optional (Standard: true). */
public record TableRequest(@NotNull @Min(1) Integer number,
                           @Size(max = 100) String name,
                           Boolean active) {

    public boolean activeOrDefault() {
        return active == null || active;
    }
}
