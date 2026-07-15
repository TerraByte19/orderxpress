package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Kategorie anlegen oder aendern. */
public record CategoryRequest(@NotBlank @Size(max = 100) String name,
                              Integer sortOrder,
                              Boolean active) {

    public int sortOrderOrDefault() {
        return sortOrder == null ? 0 : sortOrder;
    }

    public boolean activeOrDefault() {
        return active == null || active;
    }
}
