package com.orderxpress;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Design pro Laden: Farben/Hamburger speichern, Validierung, Logo/Hintergrund hochladen/abrufen/loeschen. */
class DesignThemeIntegrationTest extends IntegrationTestBase {

    @Test
    void designSpeichernUndOeffentlichesThemeLesen() throws Exception {
        Owner o = createRestaurant("design");
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accentColor\":\"#ff0000\",\"backgroundColor\":\"#00ff00\",\"categoriesAsHamburger\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accentColor").value("#ff0000"))
                .andExpect(jsonPath("$.categoriesAsHamburger").value(true));

        // Gaeste-Theme (oeffentlich) spiegelt die Werte
        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accentColor").value("#ff0000"))
                .andExpect(jsonPath("$.backgroundColor").value("#00ff00"))
                .andExpect(jsonPath("$.categoriesAsHamburger").value(true))
                .andExpect(jsonPath("$.logoUrl").doesNotExist());
    }

    @Test
    void ungueltigeFarbeWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("color");
        mvc.perform(put("/api/admin/design").with(as(o))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accentColor\":\"rot\",\"backgroundColor\":\"#00ff00\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void logoHochladenAbrufenUndLoeschen() throws Exception {
        Owner o = createRestaurant("logo");

        mvc.perform(multipart("/api/admin/design/logo").with(as(o))
                        .file(new MockMultipartFile("file", "logo.png", "image/png", testPng())))
                .andExpect(status().isNoContent());

        // Theme verweist nun auf das Logo
        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoUrl").value("/api/guest/restaurants/" + o.restaurantId() + "/logo"));

        // Bild ist oeffentlich abrufbar
        mvc.perform(get("/api/guest/restaurants/" + o.restaurantId() + "/logo"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));

        // Loeschen -> 404 beim Abruf, Theme ohne logoUrl
        mvc.perform(delete("/api/admin/design/logo").with(as(o)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/guest/restaurants/" + o.restaurantId() + "/logo"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/guest/theme/" + o.restaurantId()))
                .andExpect(jsonPath("$.logoUrl").doesNotExist());
    }

    @Test
    void hintergrundHochladenUndAbrufen() throws Exception {
        Owner o = createRestaurant("bg");
        mvc.perform(multipart("/api/admin/design/background").with(as(o))
                        .file(new MockMultipartFile("file", "bg.jpg", "image/jpeg", testJpeg())))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/guest/restaurants/" + o.restaurantId() + "/background"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG));
    }

    @Test
    void nichtBildWirdAbgelehnt() throws Exception {
        Owner o = createRestaurant("nopng");
        mvc.perform(multipart("/api/admin/design/logo").with(as(o))
                        .file(new MockMultipartFile("file", "x.txt", "text/plain", "kein Bild".getBytes())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void designOhneLoginGesperrt() throws Exception {
        mvc.perform(get("/api/admin/design"))
                .andExpect(status().isUnauthorized());
    }

    private static byte[] testPng() throws Exception {
        BufferedImage img = new BufferedImage(300, 120, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(30, 90, 200));
        g.fillRect(0, 0, 300, 120);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private static byte[] testJpeg() throws Exception {
        BufferedImage img = new BufferedImage(1600, 900, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(200, 80, 40));
        g.fillRect(0, 0, 1600, 900);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", out);
        return out.toByteArray();
    }
}
