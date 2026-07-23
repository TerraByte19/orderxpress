package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Tische: anlegen, doppelte Nummer, bearbeiten, deaktivieren, QR neu erzeugen, QR-PNG, loeschen. */
class TableManagementIntegrationTest extends IntegrationTestBase {

    @Test
    void tischAnlegenUndDoppelteNummerAblehnen() throws Exception {
        Owner o = createRestaurant("t-dup");
        createTable(o, 5);
        mvc.perform(post("/api/admin/tables").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":5}"))
                .andExpect(status().isConflict());
    }

    @Test
    void tischnummerUnter1IstUngueltig() throws Exception {
        Owner o = createRestaurant("t-val");
        mvc.perform(post("/api/admin/tables").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":0}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tischBearbeitenAufBelegteNummerAblehnen() throws Exception {
        Owner o = createRestaurant("t-edit");
        createTable(o, 1);
        TableRef t2 = createTable(o, 2);
        mvc.perform(put("/api/admin/tables/" + t2.id()).with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":1}"))
                .andExpect(status().isConflict());
    }

    @Test
    void inaktiverTischLaesstKeinenScanZu() throws Exception {
        Owner o = createRestaurant("t-off");
        TableRef t = createTable(o, 1);
        mvc.perform(put("/api/admin/tables/" + t.id()).with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"number\":1,\"active\":false}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/guest/scan/" + t.qrToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    void qrTokenNeuErzeugenMachtAltenUngueltig() throws Exception {
        Owner o = createRestaurant("t-qr");
        TableRef t = createTable(o, 1);
        String body = mvc.perform(post("/api/admin/tables/" + t.id() + "/regenerate-qr").with(as(o)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String newToken = JsonPath.read(body, "$.qrToken");
        org.junit.jupiter.api.Assertions.assertNotEquals(t.qrToken(), newToken);

        // Alter Token funktioniert nicht mehr, neuer schon
        mvc.perform(post("/api/guest/scan/" + t.qrToken()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/guest/scan/" + newToken))
                .andExpect(status().isOk());
    }

    @Test
    void qrCodePngWirdGeliefert() throws Exception {
        Owner o = createRestaurant("t-png");
        TableRef t = createTable(o, 1);
        mvc.perform(get("/api/admin/tables/" + t.id() + "/qrcode").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));
    }

    @Test
    void freienTischLoeschen() throws Exception {
        Owner o = createRestaurant("t-del");
        TableRef t = createTable(o, 1);
        mvc.perform(delete("/api/admin/tables/" + t.id()).with(as(o)))
                .andExpect(status().isNoContent());
    }

    @Test
    void tischListeZeigtBelegtStatusNachFreigabe() throws Exception {
        Owner o = createRestaurant("t-occ");
        TableRef t = createTable(o, 1);
        hostAtApprovedTable(o, t);
        // Der frische Laden hat genau diesen einen Tisch -> eindeutiger Pfad statt Filter
        mvc.perform(get("/api/admin/tables").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].number").value(1))
                .andExpect(jsonPath("$[0].occupied").value(true))
                .andExpect(jsonPath("$[0].currentSessionId").isNumber());
    }
}
