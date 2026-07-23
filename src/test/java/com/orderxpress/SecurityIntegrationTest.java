package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Prueft die Zugriffsregeln: Gaeste oeffentlich, Verwaltung nur Inhaber,
 * Kuechen-Ansicht fuer Kueche und Inhaber.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void gastEndpunkteSindOeffentlich() throws Exception {
        // Menue eines Ladens ist ohne Login abrufbar (Demo-Laden hat id 1).
        mockMvc.perform(get("/api/guest/menu/1"))
                .andExpect(status().isOk());
    }

    @Test
    void adminOhneLoginWirdAbgewiesen() throws Exception {
        mockMvc.perform(get("/api/admin/sessions/pending"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void kuechenLoginDarfNichtInDieVerwaltung() throws Exception {
        mockMvc.perform(get("/api/admin/sessions/pending")
                        .with(httpBasic("kueche", "kueche123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void inhaberDarfInDieKuechenAnsicht() throws Exception {
        mockMvc.perform(get("/api/kitchen/orders")
                        .with(httpBasic("inhaber", "inhaber123")))
                .andExpect(status().isOk());
    }

    @Test
    void kuecheOhneLoginWirdAbgewiesen() throws Exception {
        mockMvc.perform(get("/api/kitchen/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unbekannteRoutenSindGesperrt() throws Exception {
        mockMvc.perform(get("/api/irgendwas"))
                .andExpect(status().isUnauthorized());
    }

    // ---------- Rolle SERVICE / Kasse ----------

    @Test
    void serviceOhneLoginWirdAbgewiesen() throws Exception {
        mockMvc.perform(get("/api/service/sessions/pending"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void serviceLoginDarfInDieServiceAnsicht() throws Exception {
        mockMvc.perform(get("/api/service/sessions/pending")
                        .with(httpBasic("service", "service123")))
                .andExpect(status().isOk());
    }

    @Test
    void serviceLoginDarfNichtInDieVerwaltung() throws Exception {
        mockMvc.perform(get("/api/admin/tables")
                        .with(httpBasic("service", "service123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void serviceLoginDarfNichtInDieKueche() throws Exception {
        mockMvc.perform(get("/api/kitchen/orders")
                        .with(httpBasic("service", "service123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void kuecheDarfNichtInDieServiceAnsicht() throws Exception {
        mockMvc.perform(get("/api/service/sessions/pending")
                        .with(httpBasic("kueche", "kueche123")))
                .andExpect(status().isForbidden());
    }

    @Test
    void inhaberDarfInServiceUndKueche() throws Exception {
        mockMvc.perform(get("/api/service/sessions/pending")
                        .with(httpBasic("inhaber", "inhaber123")))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/kitchen/orders")
                        .with(httpBasic("inhaber", "inhaber123")))
                .andExpect(status().isOk());
    }

    @Test
    void platformAdminDarfNichtInDenLadenBereich() throws Exception {
        // Der Plattform-Admin gehoert keinem Laden an -> kein Zugriff auf /api/admin
        mockMvc.perform(get("/api/admin/tables")
                        .with(httpBasic("admin", "test-admin")))
                .andExpect(status().isForbidden());
    }

    @Test
    void falschesPasswortWirdAbgewiesen() throws Exception {
        mockMvc.perform(get("/api/admin/tables")
                        .with(httpBasic("inhaber", "falsch")))
                .andExpect(status().isUnauthorized());
    }
}
