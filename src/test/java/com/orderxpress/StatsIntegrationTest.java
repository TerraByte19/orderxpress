package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Statistik des Inhabers: Kennzahlen und Bestseller pro Zeitraum, Ausschluss
 * stornierter Bestellungen, Mandanten-Trennung, Zugriffsrechte sowie die beiden
 * Loesch-Wege (Zuruecksetzen behaelt die Bestellungen, Verlauf-Loeschen entfernt
 * nur abgeschlossene Sitzungen).
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
    void umsatzBestsellerUndDurchschnitt() throws Exception {
        Owner o = createRestaurant("stats");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");
        long cola = createItem(o, cat, "Cola", "2.50");
        TableRef t = createTable(o, 1);
        String host = hostAtApprovedTable(o, t);

        order(host, pizza, 2);   // 14.00
        order(host, cola, 1);    //  2.50  -> Summe 16.50, 2 Bestellungen, 3 Artikel, Schnitt 8.25

        String body = mvc.perform(get("/api/admin/stats?range=today").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(2))
                .andExpect(jsonPath("$.itemCount").value(3))
                .andExpect(jsonPath("$.byHour.length()").value(24))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenue", "16.50");
        assertMoney(body, "$.avgOrder", "8.25");

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

        mvc.perform(post("/api/kitchen/orders/" + drop + "/status").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CANCELLED\"}"))
                .andExpect(status().isOk());

        String body = mvc.perform(get("/api/admin/stats?range=today").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(1))
                .andExpect(jsonPath("$.itemCount").value(1))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenue", "7.00");
    }

    @Test
    void zeitraeumeUndDatumsbereich() throws Exception {
        Owner o = createRestaurant("stats-range");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");
        TableRef t = createTable(o, 1);
        String host = hostAtApprovedTable(o, t);
        order(host, pizza, 1);   // heute, 7.00

        // Heute/Woche/Monat/Gesamt enthalten die heutige Bestellung
        for (String range : new String[]{"today", "week", "month", "total"}) {
            String b = mvc.perform(get("/api/admin/stats?range=" + range).with(as(o)))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            assertMoney(b, "$.revenue", "7.00");
        }

        // Freier Datumsbereich weit in der Vergangenheit -> nichts
        String past = mvc.perform(get("/api/admin/stats?range=custom&from=2000-01-01&to=2000-01-02").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(0))
                .andReturn().getResponse().getContentAsString();
        assertMoney(past, "$.revenue", "0");
    }

    @Test
    void zuruecksetzenZaehltAbJetztNeuBehaeltBestellungen() throws Exception {
        Owner o = createRestaurant("stats-reset");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");
        TableRef t = createTable(o, 1);
        String host = hostAtApprovedTable(o, t);
        order(host, pizza, 2);   // 14.00

        String before = mvc.perform(get("/api/admin/stats?range=total").with(as(o)))
                .andExpect(jsonPath("$.orderCount").value(1))
                .andReturn().getResponse().getContentAsString();
        assertMoney(before, "$.revenue", "14.00");

        // zuruecksetzen -> ab jetzt neu zaehlen
        mvc.perform(post("/api/admin/stats/reset").with(as(o)))
                .andExpect(status().isNoContent());

        String after = mvc.perform(get("/api/admin/stats?range=total").with(as(o)))
                .andExpect(jsonPath("$.orderCount").value(0))
                .andReturn().getResponse().getContentAsString();
        assertMoney(after, "$.revenue", "0");

        // Die Bestellung ist NICHT geloescht - sie taucht in der Uebersicht noch auf
        mvc.perform(get("/api/admin/orders").with(as(o)))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void verlaufLoeschenNurAbgeschlosseneSitzungen() throws Exception {
        Owner o = createRestaurant("stats-del");
        long cat = createCategory(o, "Speisen");
        long pizza = createItem(o, cat, "Pizza", "7.00");

        // Tisch 1: bestellen, dann Sitzung schliessen (abgeschlossen)
        TableRef a = createTable(o, 1);
        String hostA = JsonPath.read(scan(a.qrToken()), "$.guestToken");
        long sessA = pendingSessionId(o, 1);
        approveSession(o, sessA);
        order(hostA, pizza, 1);   // 7.00, wird spaeter geloescht
        mvc.perform(post("/api/admin/sessions/" + sessA + "/close").with(as(o)))
                .andExpect(status().isOk());

        // Tisch 2: bestellen, Sitzung bleibt offen (APPROVED)
        TableRef b = createTable(o, 2);
        String hostB = JsonPath.read(scan(b.qrToken()), "$.guestToken");
        long sessB = pendingSessionId(o, 2);
        approveSession(o, sessB);
        order(hostB, pizza, 2);   // 14.00, bleibt erhalten

        // Verlauf loeschen -> nur die abgeschlossene Sitzung (Tisch 1) faellt weg
        String del = mvc.perform(delete("/api/admin/stats/history").with(as(o)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Assertions.assertEquals(1, (int) JsonPath.read(del, "$.deleted"));

        // Gesamt-Statistik zeigt jetzt nur noch den offenen Tisch 2
        String body = mvc.perform(get("/api/admin/stats?range=total").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(1))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenue", "14.00");
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

        String body = mvc.perform(get("/api/admin/stats?range=total").with(as(a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCount").value(0))
                .andExpect(jsonPath("$.topProducts.length()").value(0))
                .andReturn().getResponse().getContentAsString();
        assertMoney(body, "$.revenue", "0");
    }

    @Test
    void statistikNurFuerInhaber() throws Exception {
        Owner o = createRestaurant("stats-role");
        createStaffUser(o, "kellner", "SERVICE");

        // Service-Login darf die Inhaber-Statistik NICHT sehen
        mvc.perform(get("/api/admin/stats?range=today").with(httpBasic("kellner", "geheim123")))
                .andExpect(status().isForbidden());
        // Ohne Login: 401
        mvc.perform(get("/api/admin/stats?range=today"))
                .andExpect(status().isUnauthorized());
    }
}
