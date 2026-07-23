package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Mitarbeiter-Logins (Service/Kueche): anlegen, Rollenrechte, sperren, Passwort, loeschen. */
class StaffUserIntegrationTest extends IntegrationTestBase {

    @Test
    void serviceLoginDarfKasseNichtAberVerwaltung() throws Exception {
        Owner o = createRestaurant("srv");
        String user = uniqueSlug("srv") + "-kellner";
        createStaffUserNamed(o, user, "SERVICE");

        // Service darf in die Service-Ansicht
        mvc.perform(get("/api/service/sessions/pending").with(httpBasic(user, "geheim123")))
                .andExpect(status().isOk());
        // aber NICHT in die Inhaber-Verwaltung
        mvc.perform(get("/api/admin/tables").with(httpBasic(user, "geheim123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void kuechenLoginDarfKuecheAberNichtServiceOderVerwaltung() throws Exception {
        Owner o = createRestaurant("kue");
        String user = uniqueSlug("kue") + "-koch";
        createStaffUserNamed(o, user, "KITCHEN");

        mvc.perform(get("/api/kitchen/orders").with(httpBasic(user, "geheim123")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/service/sessions/pending").with(httpBasic(user, "geheim123")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/tables").with(httpBasic(user, "geheim123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void inhaberDarfServiceUndKuecheGleichzeitig() throws Exception {
        Owner o = createRestaurant("own");
        mvc.perform(get("/api/service/sessions/pending").with(as(o)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/kitchen/orders").with(as(o)))
                .andExpect(status().isOk());
    }

    @Test
    void doppelterBenutzernameWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("dupu");
        String user = uniqueSlug("dupu") + "-x";
        createStaffUserNamed(o, user, "SERVICE");
        mvc.perform(post("/api/admin/users").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + user + "\",\"password\":\"geheim123\",\"role\":\"KITCHEN\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void inhaberLoginKannManHierNichtAnlegen() throws Exception {
        Owner o = createRestaurant("noowner");
        mvc.perform(post("/api/admin/users").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + uniqueSlug("o") + "\",\"password\":\"geheim123\",\"role\":\"OWNER\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void gesperrterLoginKannSichNichtMehrAnmelden() throws Exception {
        Owner o = createRestaurant("lock");
        String user = uniqueSlug("lock") + "-s";
        long id = createStaffUserNamed(o, user, "SERVICE");

        // sperren
        mvc.perform(put("/api/admin/users/" + id).with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":false}"))
                .andExpect(status().isOk());
        // Login schlaegt jetzt fehl
        mvc.perform(get("/api/service/sessions/pending").with(httpBasic(user, "geheim123")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void passwortAendernFunktioniert() throws Exception {
        Owner o = createRestaurant("pw");
        String user = uniqueSlug("pw") + "-s";
        long id = createStaffUserNamed(o, user, "SERVICE");

        mvc.perform(put("/api/admin/users/" + id).with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"neuespasswort\"}"))
                .andExpect(status().isOk());
        // altes Passwort geht nicht mehr, neues schon
        mvc.perform(get("/api/service/sessions/pending").with(httpBasic(user, "geheim123")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/service/sessions/pending").with(httpBasic(user, "neuespasswort")))
                .andExpect(status().isOk());
    }

    @Test
    void geloeschterLoginKannSichNichtAnmelden() throws Exception {
        Owner o = createRestaurant("delu");
        String user = uniqueSlug("delu") + "-s";
        long id = createStaffUserNamed(o, user, "SERVICE");
        mvc.perform(delete("/api/admin/users/" + id).with(as(o)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/service/sessions/pending").with(httpBasic(user, "geheim123")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mitarbeiterListeZeigtRolle() throws Exception {
        Owner o = createRestaurant("list");
        createStaffUserNamed(o, uniqueSlug("l") + "-svc", "SERVICE");
        createStaffUserNamed(o, uniqueSlug("l") + "-kit", "KITCHEN");
        mvc.perform(get("/api/admin/users").with(as(o)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.role == 'SERVICE')]").exists())
                .andExpect(jsonPath("$[?(@.role == 'KITCHEN')]").exists());
    }

    private long createStaffUserNamed(Owner o, String username, String role) throws Exception {
        String body = mvc.perform(post("/api/admin/users").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"geheim123\",\"role\":\"" + role + "\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return num(com.jayway.jsonpath.JsonPath.read(body, "$.id"));
    }
}
