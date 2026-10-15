package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Kasse: Teilmengen bezahlen (1 von 5 Cola) und Storno-Regeln:
 * Kellner storniert nur NEUE Bestellungen, Kueche auch in Zubereitung,
 * bezahlte Bestellungen lassen sich nicht stornieren.
 */
class TeilzahlungUndStornoIntegrationTest extends IntegrationTestBase {

    private record Ctx(Owner owner, String host, long orderId, long orderItemId) {}

    /** Tisch mit einer Bestellung "5x Cola" zu 3,00 EUR. */
    private Ctx fuenfCola(String prefix) throws Exception {
        Owner o = createRestaurant(prefix);
        long cat = createCategory(o, "Getraenke");
        long cola = createItem(o, cat, "Cola", "3.00");
        TableRef t = createTable(o, 4);
        String host = hostAtApprovedTable(o, t);
        String body = mvc.perform(post("/api/guest/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"guestToken\":\"" + host + "\",\"items\":[{\"menuItemId\":"
                                + cola + ",\"quantity\":5}]}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long orderId = num(JsonPath.read(body, "$.id"));
        String bill = mvc.perform(get("/api/guest/guests/" + host + "/bill"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long itemId = num(JsonPath.read(bill, "$.participants[0].items[0].orderItemId"));
        return new Ctx(o, host, orderId, itemId);
    }

    private ResultActions pay(Ctx c, int quantity) throws Exception {
        return mvc.perform(post("/api/waiter/settle").with(as(c.owner()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[{\"orderItemId\":" + c.orderItemId() + ",\"quantity\":" + quantity + "}]}"));
    }

    private String bill(Ctx c) throws Exception {
        return mvc.perform(get("/api/guest/guests/" + c.host() + "/bill"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private ResultActions kitchenStatus(Ctx c, String status) throws Exception {
        return mvc.perform(post("/api/kitchen/orders/" + c.orderId() + "/status").with(as(c.owner()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }

    private ResultActions waiterCancel(Ctx c) throws Exception {
        return mvc.perform(post("/api/waiter/orders/" + c.orderId() + "/cancel").with(as(c.owner())));
    }

    @Test
    void teilmengeBezahlen() throws Exception {
        Ctx c = fuenfCola("teil1");

        pay(c, 2).andExpect(status().isNoContent());
        String b = bill(c);
        assertMoney(b, "$.paidTotal", "6.00");
        assertMoney(b, "$.openTotal", "9.00");
        mvc.perform(get("/api/guest/guests/" + c.host() + "/bill"))
                .andExpect(jsonPath("$.participants[0].items[0].paidQuantity").value(2))
                .andExpect(jsonPath("$.participants[0].items[0].paid").value(false));

        // mehr als offen -> abgelehnt, nichts gebucht
        pay(c, 4).andExpect(status().isConflict());
        assertMoney(bill(c), "$.openTotal", "9.00");

        // Rest bezahlen -> Position komplett bezahlt
        pay(c, 3).andExpect(status().isNoContent());
        String fertig = bill(c);
        assertMoney(fertig, "$.openTotal", "0");
        mvc.perform(get("/api/guest/guests/" + c.host() + "/bill"))
                .andExpect(jsonPath("$.participants[0].items[0].paid").value(true))
                .andExpect(jsonPath("$.participants[0].items[0].paidQuantity").value(5));
    }

    @Test
    void ganzePositionBezahltNurNochDenRest() throws Exception {
        Ctx c = fuenfCola("teil2");
        pay(c, 1).andExpect(status().isNoContent());

        // alte Form (orderItemIds) = alles Offene
        mvc.perform(post("/api/waiter/settle").with(as(c.owner()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderItemIds\":[" + c.orderItemId() + "]}"))
                .andExpect(status().isNoContent());
        String b = bill(c);
        assertMoney(b, "$.paidTotal", "15.00");
        assertMoney(b, "$.openTotal", "0");
    }

    @Test
    void ungueltigeMengeUndLeereAuswahlAbgelehnt() throws Exception {
        Ctx c = fuenfCola("teil3");
        pay(c, 0).andExpect(status().isBadRequest());
        mvc.perform(post("/api/waiter/settle").with(as(c.owner()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void kellnerStorniertNeueBestellung() throws Exception {
        Ctx c = fuenfCola("storno1");
        waiterCancel(c)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(get("/api/guest/guests/" + c.host() + "/bill"))
                .andExpect(jsonPath("$.participants.length()").value(0));
    }

    @Test
    void kellnerDarfNichtMehrStornierenWennKuecheAngefangenHat() throws Exception {
        Ctx c = fuenfCola("storno2");
        kitchenStatus(c, "IN_PREPARATION").andExpect(status().isOk());
        waiterCancel(c).andExpect(status().isConflict());

        // Kueche darf in Zubereitung stornieren
        kitchenStatus(c, "CANCELLED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void bezahlteBestellungNichtStornierbar() throws Exception {
        Ctx c = fuenfCola("storno3");
        pay(c, 1).andExpect(status().isNoContent());
        waiterCancel(c).andExpect(status().isConflict());
        kitchenStatus(c, "CANCELLED").andExpect(status().isConflict());
    }

    @Test
    void stornierteBestellungNichtBezahlbar() throws Exception {
        Ctx c = fuenfCola("storno4");
        waiterCancel(c).andExpect(status().isOk());
        pay(c, 1).andExpect(status().isConflict());
    }

    @Test
    void kellnerStorniertNichtImFremdenLaden() throws Exception {
        Ctx c = fuenfCola("storno5");
        Owner other = createRestaurant("storno5-other");
        mvc.perform(post("/api/waiter/orders/" + c.orderId() + "/cancel").with(as(other)))
                .andExpect(status().isNotFound());
    }
}
