package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Die sechs Struktur-Achsen eines Ladens: Aufbau der Speisekarte
 * (menuLayout), Kopf (heroStyle), Kategorien-Navigation (categoryStyle),
 * Hintergrund-Textur (textureStyle), Knopf-Optik (controlStyle) und
 * Bewegungsstaerke (motionLevel).
 *
 * Anders als die aelteren Achsen (Farbe, Schrift, Radius) aendern sie Aufbau
 * und Rhythmus der Gaeste-Seite. Alle Spalten sind nullable - ein bestehender
 * Laden muss also ohne Datenbank-Reset auskommen und seine bisherige Optik
 * behalten. Genau das pruefen die ersten beiden Tests.
 */
class StructureAxesIntegrationTest extends IntegrationTestBase {

    private static final String FARBEN = "\"accentColor\":\"#112233\",\"backgroundColor\":\"#f0f0f0\"";

    @Test
    void neuerLadenLiefertDieStandardwerteDerAchsen() throws Exception {
        Owner o = createRestaurant("achsen-standard");

        // Ohne je gespeichert zu haben: die Getter in Restaurant.java fallen
        // auf den Standard zurueck, das Theme liefert also nie null.
        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.menuLayout").value("LISTE"))
                .andExpect(jsonPath("$.heroStyle").value("BAND"))
                .andExpect(jsonPath("$.categoryStyle").value("REITER"))
                .andExpect(jsonPath("$.textureStyle").value("KEIN"))
                .andExpect(jsonPath("$.controlStyle").value("FLACH"))
                .andExpect(jsonPath("$.motionLevel").value("NORMAL"));
    }

    @Test
    void achsenSpeichernUndOeffentlichLesen() throws Exception {
        Owner o = createRestaurant("achsen-speichern");

        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"menuLayout\":\"TAFEL\",\"heroStyle\":\"SCHLICHT\","
                                + "\"categoryStyle\":\"KAPITEL\",\"textureStyle\":\"LINIEN\","
                                + "\"controlStyle\":\"RAHMEN\",\"motionLevel\":\"DEZENT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.menuLayout").value("TAFEL"));

        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.menuLayout").value("TAFEL"))
                .andExpect(jsonPath("$.heroStyle").value("SCHLICHT"))
                .andExpect(jsonPath("$.categoryStyle").value("KAPITEL"))
                .andExpect(jsonPath("$.textureStyle").value("LINIEN"))
                .andExpect(jsonPath("$.controlStyle").value("RAHMEN"))
                .andExpect(jsonPath("$.motionLevel").value("DEZENT"));
    }

    @Test
    void unbekannterAchsenwertWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("achsen-ungueltig");

        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"menuLayout\":\"GALERIE\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"motionLevel\":\"WILD\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void categoryStyleFuehrtUndZiehtDenAelterenHamburgerSchalterMit() throws Exception {
        Owner o = createRestaurant("achsen-kategorie");

        // HAMBURGER ueber die neue Achse -> der alte Schalter steht ebenfalls auf true,
        // damit aeltere Clients und Ansichten unveraendert weiterarbeiten.
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"categoryStyle\":\"HAMBURGER\",\"categoriesAsHamburger\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryStyle").value("HAMBURGER"))
                .andExpect(jsonPath("$.categoriesAsHamburger").value(true));

        // KAPITEL ist kein Hamburger -> der alte Schalter geht wieder aus.
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"categoryStyle\":\"KAPITEL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryStyle").value("KAPITEL"))
                .andExpect(jsonPath("$.categoriesAsHamburger").value(false));
    }

    @Test
    void alterClientOhneDieAchseAendertDieNavigationNicht() throws Exception {
        Owner o = createRestaurant("achsen-alterclient");

        // Ein Client, der categoryStyle noch gar nicht kennt, schickt nur den
        // alten Schalter. Daraus muss HAMBURGER werden - nicht der Standard
        // REITER, sonst wuerde ein Speichern die Einstellung des Ladens
        // stillschweigend zuruecksetzen.
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"categoriesAsHamburger\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categoryStyle").value("HAMBURGER"))
                .andExpect(jsonPath("$.categoriesAsHamburger").value(true));
    }

    @Test
    void alterClientOhneAchsenSetztDieUebrigenAufIhrenStandard() throws Exception {
        Owner o = createRestaurant("achsen-alterclient2");

        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + ",\"menuLayout\":\"KACHELN\",\"motionLevel\":\"VERSPIELT\"}"))
                .andExpect(status().isOk());

        // Ein Speichern ohne die Achsen schreibt die Standardwerte - dasselbe
        // Verhalten wie bei den aelteren Achsen (styleShape, displayFont, ...),
        // damit das Formular immer den ganzen Datensatz beschreibt.
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + FARBEN + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.menuLayout").value("LISTE"))
                .andExpect(jsonPath("$.motionLevel").value("NORMAL"));
    }
}
