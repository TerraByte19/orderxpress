package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tages-Statistik des Inhabers: Umsatz heute, Anzahl Bestellungen/Artikel und
 * die meistverkauften Produkte. Prueft echte Werte, den Ausschluss stornierter
 * Bestellungen, die Mandanten-Trennung und die Zugriffsrechte (nur Inhaber).
 */
class StatsIntegrationTest extends IntegrationTestBase {

    /** Bestellung mit frei waehlbarer Menge aufgeben; liefert die Bestell-Id. */
    private long order(String guestToken, long itemId, int qty) throws Exception {
        String body = mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"" + guestToken + "\",\"items\":[{\"menuItemId\":"
                                + itemId + ",\"quantity\":" + qty + "}]}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return num(JsonPath.read(body, "$.id"));
    }

    @Test
    void umsatzUndBestsellerWerdenBerechnet() throws Exception {
        Owner o = createRestaurant("stats");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");
        long cola = createItem(o, cat, "Cola", "2.50");
        TableRef t = createTable(o, 1);
        String host = hostAtApprovedTable(o, t);

        order(host, pizza, 2);   // 14.00
        order(host, cola, 1);    //  2.50  -> Summe 16.50, 2 Bestellungen, 3 Artikel

        String body = mvc.perform(get("/api/admin/stats").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(2))
                .andExpect(jsonPath("$.itemCount").value(3))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenueToday", "16.50");

        // Pizza ist meistverkauft (2x) und steht vorne
        Assertions.assertEquals("Pizza", JsonPath.read(body, "$.topProducts[0].name"));
        Assertions.assertEquals(2, (int) JsonPath.read(body, "$.topProducts[0].quantity"));
        assertMoney(body, "$.topProducts[0].revenue", "14.00");
    }

    @Test
    void stornierteBestellungZaehltNicht() throws Exception {
        Owner o = createRestaurant("stats-cancel");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");
        TableRef t = createTable(o, 1);
        String host = hostAtApprovedTable(o, t);

        order(host, pizza, 1);              // bleibt
        long drop = order(host, pizza, 3);  // wird storniert

        // Inhaber storniert die zweite Bestellung ueber den Kuechen-Kanal
        mvc.perform(post("/api/kitchen/orders/" + drop + "/status").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk());

        String body = mvc.perform(get("/api/admin/stats").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(1))
                .andExpect(jsonPath("$.itemCount").value(1))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenueToday", "7.00");
    }

    @Test
    void statistikNurFuerEigenenLaden() throws Exception {
        Owner a = createRestaurant("stats-a");
        Owner b = createRestaurant("stats-b");
        long catB = createCategory(b, "Speisen");
        long pizzaB = createItem(b, catB, "Pizza", "7.00");
        TableRef tB = createTable(b, 1);
        String hostB = hostAtApprovedTable(b, tB);
        order(hostB, pizzaB, 2);

        // Laden A hat nichts verkauft -> Statistik leer, sieht die Verkaeufe von B NICHT
        String body = mvc.perform(get("/api/admin/stats").with(as(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(0))
                .andExpect(jsonPath("$.itemCount").value(0))
                .andExpect(jsonPath("$.topProducts.length()").value(0))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenueToday", "0");
    }

    @Test
    void statistikNurFuerInhaber() throws Exception {
        Owner o = createRestaurant("stats-role");
        createStaffUser(o, "kellner", "SERVICE");

        // Service-Login darf die Inhaber-Statistik NICHT sehen
        mvc.perform(get("/api/admin/stats").with(httpBasic("kellner", "geheim123")))
                .andExpect(status().isForbidden());
        // Ohne Login: 401
        mvc.perform(get("/api/admin/stats"))
                .andExpect(status().isUnauthorized());
    }
}
