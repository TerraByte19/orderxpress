package com.orderxpress.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Kasse: Positionen als bezahlt markieren.
 * <ul>
 *   <li>{@code items}: je Position die Stueckzahl, z.B. 1 von 5 Cola.</li>
 *   <li>{@code orderItemIds}: ganze Positionen (alles noch Offene) - aeltere Form.</li>
 * </ul>
 * Beides darf gemischt werden, mindestens eins muss etwas enthalten.
 */
public record SettleRequest(List<Long> orderItemIds,
                            @Valid List<Part> items) {

    /** Teilzahlung einer Position: so viele Stueck bezahlen. */
    public record Part(@NotNull Long orderItemId, @Min(1) int quantity) {
    }

    public List<Long> orderItemIds() {
        return orderItemIds == null ? List.of() : orderItemIds;
    }

    public List<Part> items() {
        return items == null ? List.of() : items;
    }

    @AssertTrue(message = "Bitte zuerst Positionen auswaehlen.")
    public boolean isAnySelected() {
        return !orderItemIds().isEmpty() || !items().isEmpty();
    }
}
