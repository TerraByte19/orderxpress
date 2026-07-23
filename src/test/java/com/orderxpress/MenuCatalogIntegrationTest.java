package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Speisekarte: Kategorien/Gerichte anlegen, aendern, Validierung, Verfuegbarkeit, Loeschen. */
class MenuCatalogIntegrationTest extends IntegrationTestBase {

    @Test
    void kategorieAnlegenUndDuplikatAblehnen() throws Exception {
        Owner o = createRestaurant("cat");
        createCategory(o, "Vorspeisen");
        mvc.perform(post("/api/admin/categories").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Vorspeisen\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void kategorieOhneNameIstUngueltig() throws Exception {
        Owner o = createRestaurant("cat2");
        mvc.perform(post("/api/admin/categories").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void gerichtAnlegenAendernVerfuegbarkeit() throws Exception {
        Owner o = createRestaurant("item");
        long cat = createCategory(o, "Hauptgerichte");
        long item = createItem(o, cat, "Schnitzel", "15.90");

        // Aendern: Preis + auf ausverkauft
        mvc.perform(put("/api/admin/menu-items/" + item).with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":" + cat + ",\"name\":\"Schnitzel\",\"price\":\"16.50\",\"available\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.price").value(16.50));

        // Ausverkauftes Gericht taucht in der Gaeste-Karte nicht auf
        mvc.perform(get("/api/guest/menu/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$..items[?(@.name == 'Schnitzel')]").doesNotExist());
    }

    @Test
    void gerichtMitUngueltigemPreisWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("price");
        long cat = createCategory(o, "K");
        mvc.perform(post("/api/admin/menu-items").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":" + cat + ",\"name\":\"Teuer\",\"price\":\"-5.00\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void gerichtInUnbekannterKategorieWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("nocat");
        mvc.perform(post("/api/admin/menu-items").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":999999,\"name\":\"X\",\"price\":\"5.00\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void kategorieMitGerichtenLaesstSichNichtLoeschen() throws Exception {
        Owner o = createRestaurant("delcat");
        long cat = createCategory(o, "Voll");
        createItem(o, cat, "Drin", "3.00");
        mvc.perform(delete("/api/admin/categories/" + cat).with(as(o)))
                .andExpect(status().isConflict());
    }

    @Test
    void gerichtUndDannLeereKategorieLoeschen() throws Exception {
        Owner o = createRestaurant("delok");
        long cat = createCategory(o, "Leerbar");
        long item = createItem(o, cat, "Weg", "3.00");
        mvc.perform(delete("/api/admin/menu-items/" + item).with(as(o)))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/categories/" + cat).with(as(o)))
                .andExpect(status().isNoContent());
    }

    @Test
    void inaktiveKategorieVerstecktGerichteVorGaesten() throws Exception {
        Owner o = createRestaurant("hidecat");
        long cat = createCategory(o, "Versteckt");
        createItem(o, cat, "Unsichtbar", "4.00");
        // Kategorie inaktiv schalten
        mvc.perform(put("/api/admin/categories/" + cat).with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Versteckt\",\"active\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/guest/menu/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$..items[?(@.name == 'Unsichtbar')]").doesNotExist());
    }

    @Test
    void speisekarteVerwaltungBrauchtLogin() throws Exception {
        mvc.perform(get("/api/admin/menu-items"))
                .andExpect(status().isUnauthorized());
    }
}
