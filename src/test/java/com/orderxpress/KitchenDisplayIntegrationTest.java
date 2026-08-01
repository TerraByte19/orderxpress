package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Schalter "Kuechen-Bildschirm" pro Laden: manche Laeden haben kein Geraet in
 * der Kueche und arbeiten nur mit dem gedruckten Bon. Der Wert wird ueber die
 * Design-Einstellungen gesetzt und ueber /api/me ausgelesen (das Frontend
 * blendet danach die Kuechen-Ansicht ein/aus).
 */
class KitchenDisplayIntegrationTest extends IntegrationTestBase {

    private String design(boolean kitchen) {
        return "{\"accentColor\":\"#2563eb\",\"backgroundColor\":\"#f4f5f7\","
                + "\"categoriesAsHamburger\":false,\"kitchenDisplayEnabled\":" + kitchen + "}";
    }

    @Test
    void schalterWirktAufDesignUndMe() throws Exception {
        Owner o = createRestaurant("kd");

        // Standard: Kueche vorhanden
        mvc.perform(get("/api/me").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kitchenDisplayEnabled").value(true));

        // ausschalten
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON).content(design(false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kitchenDisplayEnabled").value(false));

        // /api/me spiegelt den Schalter
        mvc.perform(get("/api/me").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kitchenDisplayEnabled").value(false));

        // wieder einschalten
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON).content(design(true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kitchenDisplayEnabled").value(true));
    }

    @Test
    void altesDesignOhneSchalterGiltAlsKuecheAn() throws Exception {
        Owner o = createRestaurant("kd-legacy");
        // DesignRequest ohne kitchenDisplayEnabled (wie alte Clients) -> Default true
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accentColor\":\"#2563eb\",\"backgroundColor\":\"#f4f5f7\",\"categoriesAsHamburger\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kitchenDisplayEnabled").value(true));
    }
}
