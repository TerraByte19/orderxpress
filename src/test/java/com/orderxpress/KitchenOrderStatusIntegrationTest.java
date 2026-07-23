package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Kueche: erlaubte/verbotene Statuswechsel, Storno, Nachdruck, Mandanten-Schutz. */
class KitchenOrderStatusIntegrationTest extends IntegrationTestBase {

    private record Ctx(Owner owner, long orderId) {}

    private Ctx orderReady(String prefix) throws Exception {
        Owner o = createRestaurant(prefix);
        long cat = createCategory(o, "K");
        long item = createItem(o, cat, "Pizza", "9.00");
        TableRef table = createTable(o, 1);
        String host = hostAtApprovedTable(o, table);
        long orderId = orderOneItem(host, item);
        return new Ctx(o, orderId);
    }

    private ResultActions setStatus(Owner o, long orderId, String status) throws Exception {
        return mvc.perform(post("/api/kitchen/orders/" + orderId + "/status").with(as(o))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }

    @Test
    void neuDirektAufFertigIstErlaubt() throws Exception {
        Ctx c = orderReady("k1");
        setStatus(c.owner(), c.orderId(), "READY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    void neuDirektAufServiertIstVerboten() throws Exception {
        Ctx c = orderReady("k2");
        setStatus(c.owner(), c.orderId(), "SERVED")
                .andExpect(status().isConflict());
    }

    @Test
    void stornoAusNeuIstErlaubt() throws Exception {
        Ctx c = orderReady("k3");
        setStatus(c.owner(), c.orderId(), "CANCELLED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void ausStorniertGehtNichtsMehr() throws Exception {
        Ctx c = orderReady("k4");
        setStatus(c.owner(), c.orderId(), "CANCELLED").andExpect(status().isOk());
        setStatus(c.owner(), c.orderId(), "IN_PREPARATION").andExpect(status().isConflict());
    }

    @Test
    void unbekannterStatusWertIst400() throws Exception {
        Ctx c = orderReady("k5");
        setStatus(c.owner(), c.orderId(), "FLIEGEN")
                .andExpect(status().isBadRequest());
    }

    @Test
    void nachdruckWirdAngenommen() throws Exception {
        Ctx c = orderReady("k6");
        mvc.perform(post("/api/kitchen/orders/" + c.orderId() + "/print").with(as(c.owner())))
                .andExpect(status().isAccepted());
    }

    @Test
    void fremderLadenKannStatusNichtAendern() throws Exception {
        Ctx c = orderReady("k7");
        Owner other = createRestaurant("k7-other");
        setStatus(other, c.orderId(), "IN_PREPARATION")
                .andExpect(status().isNotFound());
    }

    @Test
    void stornierteBestellungZaehltNichtInDerRechnung() throws Exception {
        Owner o = createRestaurant("k8");
        long cat = createCategory(o, "K");
        long item = createItem(o, cat, "Suppe", "5.00");
        TableRef table = createTable(o, 1);
        String host = hostAtApprovedTable(o, table);
        long orderId = orderOneItem(host, item);
        setStatus(o, orderId, "CANCELLED").andExpect(status().isOk());

        // Storno -> keine Positionen in der geteilten Rechnung
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/guest/guests/" + host + "/bill"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(0));
    }
}
