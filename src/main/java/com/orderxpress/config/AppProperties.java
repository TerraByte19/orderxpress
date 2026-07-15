package com.orderxpress.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Alle app-spezifischen Einstellungen aus application.yml (Prefix "orderxpress").
 */
@ConfigurationProperties(prefix = "orderxpress")
@Validated
public record AppProperties(
        @NotBlank String publicBaseUrl,
        @NotNull @Valid Security security,
        @NotNull @Valid Printer printer,
        @NotNull @Valid Session session) {

    public record Security(@NotNull @Valid Account platformAdmin) {
    }

    public record Account(@NotBlank String username,
                          @NotBlank String password) {
    }

    public record Printer(@NotNull PrinterMode mode,
                          String host,
                          @Min(1) @Max(65535) int port) {
    }

    public enum PrinterMode {LOG, NETWORK}

    public record Session(@Min(1) int pendingTimeoutMinutes) {
    }
}
