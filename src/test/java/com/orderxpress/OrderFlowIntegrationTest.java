package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Kompletter Ablauf mit einem eigenen Test-Laden:
 * Scan (Gastgeber) -> "Tisch freigeben?" -> Laden-Freigabe -> Menue -> Bestellung
 * -> Kueche -> Statuswechsel -> Sitzung beenden.
 */
class OrderFlowIntegrationTest extends IntegrationTestBase {

    private static final String KITCHEN = "kueche";
    private static final String KITCHEN_PASSWORD = "kueche123";

    @Test
    void kompletterBestellablaufVonScanBisServiert() throws Exception {
        Owner o = createRestaurant("flow");
        long cat = createCategory(o, "Hauptgerichte");
        long item = createItem(o, cat, "Schnitzel", "16.90");
        TableRef table = createTable(o, 1);

        // 1) Erste Person scannt -> Gastgeber, wartet auf Laden-Freigabe
        String scanBody = scan(table.qrToken());
        org.junit.jupiter.api.Assertions.assertEquals(Boolean.TRUE, JsonPath.read(scanBody, "$.isHost"));
        org.junit.jupiter.api.Assertions.assertEquals("PENDING", JsonPath.read(scanBody, "$.sessionStatus"));
        String guestToken = JsonPath.read(scanBody, "$.guestToken");

        // 2) Karte des Ladens (oeffentlich)
        mvc.perform(get("/api/guest/menu/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].items[0].id").value((int) item));

        // 3) Bestellen VOR der Freigabe ist nicht erlaubt
        mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson(guestToken, item)))
                .andExpect(status().isConflict());

        // 4) + 5) Inhaber sieht die Anfrage und gibt frei
        long sessionId = pendingSessionId(o, table.number());
        mvc.perform(post("/api/admin/sessions/" + sessionId + "/approve").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // 6) Gastgeber ist jetzt freigegeben
        mvc.perform(get("/api/guest/guests/" + guestToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.guestStatus").value("APPROVED"))
                .andExpect(jsonPath("$.sessionStatus").value("APPROVED"));

        // 7) Gast bestellt -> Preis vom Server, Status NEW
        String orderBody = mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson(guestToken, item)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("NEW"))
                .andExpect(jsonPath("$.tableNumber").value(1))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andReturn().getResponse().getContentAsString();
        int orderId = (int) num(JsonPath.read(orderBody, "$.id"));

        // 7b) "Meine Bestellungen"
        mvc.perform(get("/api/guest/guests/" + guestToken + "/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(orderId));

        // 8) Kueche sieht die Bestellung
        mvc.perform(get("/api/kitchen/orders").with(httpBasic(KITCHEN, KITCHEN_PASSWORD)))
                .andExpect(status().isOk());

        // 9) Inhaber (darf auch Kueche) schaltet den Status weiter
        updateStatus(o, orderId, "IN_PREPARATION").andExpect(status().isOk());
        updateStatus(o, orderId, "READY").andExpect(status().isOk());
        updateStatus(o, orderId, "SERVED").andExpect(status().isOk());

        // 10) Unsinniger Statuswechsel wird abgelehnt
        updateStatus(o, orderId, "IN_PREPARATION").andExpect(status().isConflict());

        // 11) Sitzung beenden -> Bestellen nicht mehr moeglich
        mvc.perform(post("/api/admin/sessions/" + sessionId + "/close").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
        mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderJson(guestToken, item)))
                .andExpect(status().isConflict());
    }

    @Test
    void nachAblehnungGreiftDieAbklingzeit() throws Exception {
        Owner o = createRestaurant("cooldown");
        TableRef table = createTable(o, 1);

        scan(table.qrToken());
        long sessionId = pendingSessionId(o, table.number());
        mvc.perform(post("/api/admin/sessions/" + sessionId + "/reject").with(as(o)))
                .andExpect(status().isOk());

        // Sofortiger erneuter Scan wird abgeblockt (Spam-Schutz)
        mvc.perform(post("/api/guest/scan/" + table.qrToken()))
                .andExpect(status().isConflict());
    }

    @Test
    void unbekannterQrCodeWirdAbgelehnt() throws Exception {
        mvc.perform(post("/api/guest/scan/gibt-es-nicht"))
                .andExpect(status().isNotFound());
    }

    @Test
    void bestellungOhnePositionenIstUngueltig() throws Exception {
        mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"egal\",\"items\":[]}"))
                .andExpect(status().isBadRequest());
    }

    private ResultActions updateStatus(Owner o, int orderId, String status) throws Exception {
        return mvc.perform(post("/api/kitchen/orders/" + orderId + "/status").with(as(o))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }

    private static String orderJson(String guestToken, long menuItemId) {
        return "{\"guestToken\":\"" + guestToken + "\",\"items\":[{\"menuItemId\":" + menuItemId
                + ",\"quantity\":2,\"note\":\"ohne Zwiebeln\"}]}";
    }
}
