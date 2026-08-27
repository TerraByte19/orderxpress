package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vier pro Laden einstellbare Achsen der Gaeste-Seite: Form, Ueberschrift-Schrift,
 * Warenkorb-Flieger und Bestell-Bestaetigung. Muster wie KitchenDisplayIntegrationTest:
 * Wert ueber /api/admin/design setzen, ueber das oeffentliche /api/guest/theme lesen.
 */
class GuestPageDesignIntegrationTest extends IntegrationTestBase {

    private String design(String extra) {
        return "{\"accentColor\":\"#2563eb\",\"backgroundColor\":\"#f4f5f7\","
                + "\"categoriesAsHamburger\":false" + extra + "}";
    }

    @Test
    void vierAchsenWerdenGesetztUndOeffentlichGelesen() throws Exception {
        Owner o = createRestaurant("axes");

        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"styleShape\":\"SOFT\",\"displayFont\":\"FRAUNCES\","
                                + "\"cartFlyStyle\":\"PHOTO\",\"orderConfirmStyle\":\"STAMP\"")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.styleShape").value("SOFT"))
                .andExpect(jsonPath("$.displayFont").value("FRAUNCES"))
                .andExpect(jsonPath("$.cartFlyStyle").value("PHOTO"))
                .andExpect(jsonPath("$.orderConfirmStyle").value("STAMP"));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.styleShape").value("SOFT"))
                .andExpect(jsonPath("$.displayFont").value("FRAUNCES"))
                .andExpect(jsonPath("$.cartFlyStyle").value("PHOTO"))
                .andExpect(jsonPath("$.orderConfirmStyle").value("STAMP"));
    }

    @Test
    void altesDesignOhneAchsenLiefertStandardwerte() throws Exception {
        Owner o = createRestaurant("axes-legacy");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design("")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.styleShape").value("SQUARE"))
                .andExpect(jsonPath("$.displayFont").value("BRICOLAGE"))
                .andExpect(jsonPath("$.cartFlyStyle").value("PLUS"))
                .andExpect(jsonPath("$.orderConfirmStyle").value("CHECK"));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(jsonPath("$.displayFont").value("BRICOLAGE"));
    }

    @Test
    void ungueltigerWertWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("axes-bad");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"styleShape\":\"ROUND\"")))
                .andExpect(status().isBadRequest());
    }
}
