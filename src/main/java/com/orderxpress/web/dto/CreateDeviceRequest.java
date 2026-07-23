package com.orderxpress.web.dto;

import com.orderxpress.domain.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Neues Geraet anlegen (Inhaber): Name + Rolle SERVICE oder KITCHEN. */
public record CreateDeviceRequest(@NotBlank @Size(max = 80) String label,
                                  @NotNull UserRole role) {
}
