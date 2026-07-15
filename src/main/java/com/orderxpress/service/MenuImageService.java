package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.MenuItemImage;
import com.orderxpress.repository.MenuItemImageRepository;
import com.orderxpress.repository.MenuItemRepository;
import com.orderxpress.web.error.BadRequestException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;

/**
 * Fotos fuer Gerichte: Upload (mit serverseitigem Verkleinern), Abruf, Loeschen.
 * Bilder werden IMMER neu kodiert - das normalisiert die Datei, entfernt
 * Metadaten (EXIF) und verhindert, dass Nicht-Bilder gespeichert werden.
 */
@Service
public class MenuImageService {

    private static final Logger log = LoggerFactory.getLogger(MenuImageService.class);

    /** Laengste Bildkante nach dem Verkleinern. */
    private static final int MAX_DIMENSION = 1000;

    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png");

    private final MenuItemRepository menuItemRepository;
    private final MenuItemImageRepository imageRepository;

    public MenuImageService(MenuItemRepository menuItemRepository,
                            MenuItemImageRepository imageRepository) {
        this.menuItemRepository = menuItemRepository;
        this.imageRepository = imageRepository;
    }

    @Transactional
    public void saveImage(Long menuItemId, MultipartFile file) {
        if (menuItemRepository.findByIdAndRestaurantId(menuItemId, CurrentUser.restaurantId()).isEmpty()) {
            throw new NotFoundException("Gericht %d nicht gefunden.".formatted(menuItemId));
        }
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Es wurde keine Bilddatei uebermittelt.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new BadRequestException("Bild ist zu gross (maximal 5 MB).");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Nur JPG- oder PNG-Bilder sind erlaubt.");
        }

        boolean png = contentType.equalsIgnoreCase("image/png");
        byte[] encoded;
        try {
            encoded = resizeAndReencode(file.getBytes(), png);
        } catch (IOException e) {
            throw new BadRequestException("Bild konnte nicht gelesen werden.");
        }

        String storedType = png ? "image/png" : "image/jpeg";
        MenuItemImage image = imageRepository.findById(menuItemId)
                .map(existing -> {
                    existing.update(storedType, encoded);
                    return existing;
                })
                .orElseGet(() -> new MenuItemImage(menuItemId, storedType, encoded));
        imageRepository.save(image);
        log.info("Bild fuer Gericht {} gespeichert ({} Bytes)", menuItemId, encoded.length);
    }

    @Transactional(readOnly = true)
    public MenuItemImage getImage(Long menuItemId) {
        return imageRepository.findById(menuItemId)
                .orElseThrow(() -> new NotFoundException("Kein Bild fuer Gericht %d vorhanden.".formatted(menuItemId)));
    }

    @Transactional
    public void deleteImage(Long menuItemId) {
        if (menuItemRepository.findByIdAndRestaurantId(menuItemId, CurrentUser.restaurantId()).isEmpty()) {
            throw new NotFoundException("Gericht %d nicht gefunden.".formatted(menuItemId));
        }
        imageRepository.deleteById(menuItemId);
    }

    /** Verkleinert auf maximal 1000px Kantenlaenge und kodiert das Bild neu. */
    private static byte[] resizeAndReencode(byte[] original, boolean png) throws IOException {
        BufferedImage source = ImageIO.read(new ByteArrayInputStream(original));
        if (source == null) {
            throw new BadRequestException("Datei ist kein lesbares Bild.");
        }

        int width = source.getWidth();
        int height = source.getHeight();
        int longest = Math.max(width, height);
        double factor = longest > MAX_DIMENSION ? MAX_DIMENSION / (double) longest : 1.0;
        int newWidth = Math.max(1, (int) Math.round(width * factor));
        int newHeight = Math.max(1, (int) Math.round(height * factor));

        // PNG behaelt Transparenz, JPG braucht einen deckenden Hintergrund
        int imageType = png ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage target = new BufferedImage(newWidth, newHeight, imageType);
        Graphics2D graphics = target.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        graphics.drawImage(source, 0, 0, newWidth, newHeight, null);
        graphics.dispose();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(target, png ? "png" : "jpg", out);
        return out.toByteArray();
    }
}
