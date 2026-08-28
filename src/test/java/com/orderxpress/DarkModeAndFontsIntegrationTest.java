package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Hell/Dunkel pro Laden (neues nullable Feld darkMode) und die drei neuen
 * displayFont-Werte MANROPE / SORA / DM_SERIF. Muster wie GuestPageDesignIntegrationTest:
 * ueber /api/admin/design setzen, ueber /api/guest/theme lesen.
 */
class DarkModeAndFontsIntegrationTest extends IntegrationTestBase {

    private String design(String extra) {
        return "{\"accentColor\":\"#2563eb\",\"backgroundColor\":\"#f4f5f7\","
                + "\"categoriesAsHamburger\":false" + extra + "}";
    }

    @Test
    void darkModeWirdGesetztUndOeffentlichGelesen() throws Exception {
        Owner o = createRestaurant("dark");

        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"darkMode\":true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.darkMode").value(true));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.darkMode").value(true));
    }

    @Test
    void altesDesignOhneDarkModeIstHell() throws Exception {
        Owner o = createRestaurant("dark-legacy");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design("")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.darkMode").value(false));
    }

    @Test
    void neueSchriftenWerdenAngenommen() throws Exception {
        Owner o = createRestaurant("fonts");
        for (String font : new String[] {"MANROPE", "SORA", "DM_SERIF"}) {
            mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                            .content(design(",\"displayFont\":\"" + font + "\"")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.displayFont").value(font));
        }
    }

    @Test
    void unbekannteSchriftWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("badfont");
        mvc.perform(put("/api/admin/design").with(as(o)).contentType(MediaType.APPLICATION_JSON)
                        .content(design(",\"displayFont\":\"COMIC_SANS\"")))
                .andExpect(status().isBadRequest());
    }
}
