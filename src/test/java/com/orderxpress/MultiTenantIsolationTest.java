package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Zwei Laeden duerfen sich NICHT in die Quere kommen (Mandanten-Trennung). */
class MultiTenantIsolationTest extends IntegrationTestBase {

    @Test
    void inhaberSiehtNurEigeneGerichte() throws Exception {
        Owner a = createRestaurant("iso-a");
        Owner b = createRestaurant("iso-b");
        long catA = createCategory(a, "Kategorie A");
        long itemA = createItem(a, catA, "Gericht A", "9.90");
        long catB = createCategory(b, "Kategorie B");
        long itemB = createItem(b, catB, "Gericht B", "8.80");

        // A sieht A, aber nicht B
        mvc.perform(get("/api/admin/menu-items").with(as(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Gericht A')]").exists())
                .andExpect(jsonPath("$[?(@.name == 'Gericht B')]").doesNotExist());

        // A kann B's Gericht nicht aendern oder loeschen -> als "nicht gefunden" behandelt
        mvc.perform(put("/api/admin/menu-items/" + itemB).with(as(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":" + catA + ",\"name\":\"Hack\",\"price\":\"1.00\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/admin/menu-items/" + itemB).with(as(a)))
                .andExpect(status().isNotFound());
        // A kann B's Kategorie nicht loeschen
        mvc.perform(delete("/api/admin/categories/" + catB).with(as(a)))
                .andExpect(status().isNotFound());
        // itemA existiert weiterhin (nur Absicherung, dass wir nichts kaputt gemacht haben)
        mvc.perform(get("/api/admin/menu-items").with(as(a)))
                .andExpect(jsonPath("$[?(@.id == " + itemA + ")]").exists());
    }

    @Test
    void gastKarteZeigtNurGerichteDesEigenenLadens() throws Exception {
        Owner a = createRestaurant("menu-a");
        Owner b = createRestaurant("menu-b");
        long catA = createCategory(a, "Speisen A");
        createItem(a, catA, "Nur bei A", "5.00");
        long catB = createCategory(b, "Speisen B");
        createItem(b, catB, "Nur bei B", "5.00");

        mvc.perform(get("/api/guest/menu/" + a.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].items[?(@.name == 'Nur bei A')]").exists())
                .andExpect(jsonPath("$..items[?(@.name == 'Nur bei B')]").doesNotExist());
    }

    @Test
    void tischeSindProLadenGetrennt() throws Exception {
        Owner a = createRestaurant("tab-a");
        Owner b = createRestaurant("tab-b");
        createTable(a, 1);
        TableRef b1 = createTable(b, 1); // gleiche Nummer bei B ist erlaubt

        // A kann B's Tisch nicht bearbeiten/loeschen
        mvc.perform(put("/api/admin/tables/" + b1.id()).with(as(a))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":99}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/admin/tables/" + b1.id()).with(as(a)))
                .andExpect(status().isNotFound());
    }

    @Test
    void gastKannKeinFremdesGerichtBestellen() throws Exception {
        Owner a = createRestaurant("ord-a");
        Owner b = createRestaurant("ord-b");
        long catA = createCategory(a, "A");
        createItem(a, catA, "A-Gericht", "9.00");
        long catB = createCategory(b, "B");
        long itemB = createItem(b, catB, "B-Gericht", "9.00");

        TableRef tableA = createTable(a, 1);
        String guest = hostAtApprovedTable(a, tableA);

        // Bestellung eines Gerichts aus Laden B ueber den Gast von Laden A -> 404
        mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"" + guest + "\",\"items\":[{\"menuItemId\":" + itemB
                                + ",\"quantity\":1}]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void kasseMarkiertKeineFremdenPositionen() throws Exception {
        Owner a = createRestaurant("settle-a");
        Owner b = createRestaurant("settle-b");
        long catA = createCategory(a, "A");
        long itemA = createItem(a, catA, "A-Gericht", "10.00");
        TableRef tableA = createTable(a, 1);
        String guest = hostAtApprovedTable(a, tableA);
        orderOneItem(guest, itemA);

        // Die orderItemId von A holen
        String bill = mvc.perform(get("/api/service/tables/" + tableA.id() + "/bill").with(as(a)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long itemLineId = num(com.jayway.jsonpath.JsonPath.read(bill, "$.participants[0].items[0].orderItemId"));

        // B versucht, A's Position zu bezahlen -> wird ignoriert (204), nichts bezahlt
        mvc.perform(post("/api/service/settle").with(as(b))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemIds\":[" + itemLineId + "]}"))
                .andExpect(status().isNoContent());

        String bill2 = mvc.perform(get("/api/service/tables/" + tableA.id() + "/bill").with(as(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants[0].items[0].paid").value(false))
                .andReturn().getResponse().getContentAsString();
        // B darf nichts von A kassiert haben: weiterhin 0 bezahlt, voller Betrag offen
        assertMoney(bill2, "$.paidTotal", "0.00");
        assertMoney(bill2, "$.openTotal", "10.00");
    }
}
