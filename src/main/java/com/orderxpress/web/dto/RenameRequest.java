package com.orderxpress.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Gast aendert seinen Anzeigenamen. */
public record RenameRequest(@NotBlank @Size(max = 60) String name) {
}
