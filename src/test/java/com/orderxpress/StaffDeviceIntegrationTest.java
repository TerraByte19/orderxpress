package com.orderxpress;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Geraete-Anmeldung per QR-Code: anlegen, einmalig aktivieren, arbeiten,
 * Rollengrenzen, Mandanten-Trennung und Sperren.
 */
class StaffDeviceIntegrationTest extends IntegrationTestBase {

    /** Legt ein Geraet an und liefert den Einmal-Token aus dem QR-Link. */
    private String createDeviceAndGetActivationToken(Owner o, String label, String role) throws Exception {
        String body = mvc.perform(post("/api/admin/devices").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"" + label + "\",\"role\":\"" + role + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.activated").value(false))
                .andExpect(jsonPath("$.activationUrl").exists())
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(body, "$.activationUrl");
        return url.substring(url.lastIndexOf('/') + 1);
    }

    private String activate(String activationToken) throws Exception {
        String body = mvc.perform(post("/api/device/activate/" + activationToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.deviceToken");
    }

    @Test
    void geraetAnlegenScannenUndArbeiten() throws Exception {
        Owner o = createRestaurant("dev");
        String activation = createDeviceAndGetActivationToken(o, "Kuechen-Tablet", "KITCHEN");

        // Scan -> dauerhafter Geraetetoken
        String deviceToken = activate(activation);
        org.junit.jupiter.api.Assertions.assertNotNull(deviceToken);

        // Das Geraet darf ohne Passwort in die Kueche
        mvc.perform(get("/api/kitchen/orders").header("X-Device-Token", deviceToken))
                .andExpect(status().isOk());
    }

    @Test
    void qrCodeFunktioniertNurEinmal() throws Exception {
        Owner o = createRestaurant("once");
        String activation = createDeviceAndGetActivationToken(o, "Kasse", "SERVICE");

        activate(activation);
        // zweiter Scan desselben Codes -> ungueltig
        mvc.perform(post("/api/device/activate/" + activation))
                .andExpect(status().isNotFound());
    }

    @Test
    void unbekannterAktivierungsCodeWirdAbgelehnt() throws Exception {
        mvc.perform(post("/api/device/activate/gibt-es-nicht"))
                .andExpect(status().isNotFound());
    }

    @Test
    void kuechenGeraetDarfNichtInDieVerwaltungOderService() throws Exception {
        Owner o = createRestaurant("devrole");
        String deviceToken = activate(createDeviceAndGetActivationToken(o, "Tablet", "KITCHEN"));

        mvc.perform(get("/api/admin/tables").header("X-Device-Token", deviceToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/service/sessions/pending").header("X-Device-Token", deviceToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void serviceGeraetDarfServiceAberNichtKueche() throws Exception {
        Owner o = createRestaurant("devsrv");
        String deviceToken = activate(createDeviceAndGetActivationToken(o, "Kasse", "SERVICE"));

        mvc.perform(get("/api/service/sessions/pending").header("X-Device-Token", deviceToken))
                .andExpect(status().isOk());
        mvc.perform(get("/api/kitchen/orders").header("X-Device-Token", deviceToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void geraetSiehtNurDenEigenenLaden() throws Exception {
        Owner a = createRestaurant("dev-a");
        Owner b = createRestaurant("dev-b");
        // Laden B hat einen belegten Tisch
        TableRef tableB = createTable(b, 1);
        hostAtApprovedTable(b, tableB);

        // Geraet von Laden A sieht die Freigaben von B NICHT
        String deviceA = activate(createDeviceAndGetActivationToken(a, "Kasse A", "SERVICE"));
        mvc.perform(get("/api/service/sessions/pending").header("X-Device-Token", deviceA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void gesperrtesGeraetFliegtRaus() throws Exception {
        Owner o = createRestaurant("devrevoke");
        String list0 = mvc.perform(post("/api/admin/devices").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Verloren\",\"role\":\"SERVICE\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long deviceId = num(JsonPath.read(list0, "$.id"));
        String url = JsonPath.read(list0, "$.activationUrl");
        String deviceToken = activate(url.substring(url.lastIndexOf('/') + 1));

        // funktioniert zunaechst
        mvc.perform(get("/api/service/sessions/pending").header("X-Device-Token", deviceToken))
                .andExpect(status().isOk());

        // Inhaber sperrt das Geraet
        mvc.perform(delete("/api/admin/devices/" + deviceId).with(as(o)))
                .andExpect(status().isNoContent());

        // ab sofort kein Zugriff mehr
        mvc.perform(get("/api/service/sessions/pending").header("X-Device-Token", deviceToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void geraetKennProfilUeberApiMe() throws Exception {
        Owner o = createRestaurant("devme");
        String deviceToken = activate(createDeviceAndGetActivationToken(o, "Kuechen-Tablet", "KITCHEN"));

        mvc.perform(get("/api/me").header("X-Device-Token", deviceToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("KITCHEN"))
                .andExpect(jsonPath("$.restaurantId").value((int) o.restaurantId()));
    }

    @Test
    void inhaberSiehtRolleUeberApiMe() throws Exception {
        Owner o = createRestaurant("me");
        mvc.perform(get("/api/me").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.restaurantName").exists());
    }

    @Test
    void qrCodeAlsPngWirdGeliefert() throws Exception {
        Owner o = createRestaurant("devpng");
        String body = mvc.perform(post("/api/admin/devices").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Tablet\",\"role\":\"KITCHEN\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long id = num(JsonPath.read(body, "$.id"));

        mvc.perform(get("/api/admin/devices/" + id + "/qrcode").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"));
    }

    @Test
    void geraetAlsInhaberRolleWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("devowner");
        mvc.perform(post("/api/admin/devices").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"Chef-Tablet\",\"role\":\"OWNER\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void geraeteVerwaltungBrauchtInhaberLogin() throws Exception {
        mvc.perform(get("/api/admin/devices"))
                .andExpect(status().isUnauthorized());
    }
}
