package com.orderxpress.service;

import com.orderxpress.config.security.CurrentUser;
import com.orderxpress.domain.AppUser;
import com.orderxpress.domain.AssetKind;
import com.orderxpress.domain.Restaurant;
import com.orderxpress.domain.RestaurantAsset;
import com.orderxpress.domain.RestaurantGalleryImage;
import com.orderxpress.domain.UserRole;
import com.orderxpress.repository.AppUserRepository;
import com.orderxpress.repository.RestaurantAssetRepository;
import com.orderxpress.repository.RestaurantGalleryImageRepository;
import com.orderxpress.repository.RestaurantRepository;
import com.orderxpress.web.dto.CreateUserRequest;
import com.orderxpress.web.dto.DesignRequest;
import com.orderxpress.web.dto.RestaurantThemeDto;
import com.orderxpress.web.dto.StaffUserDto;
import com.orderxpress.web.dto.UpdateUserRequest;
import com.orderxpress.web.error.BadRequestException;
import com.orderxpress.web.error.ConflictException;
import com.orderxpress.web.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
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
import java.util.List;
import java.util.Set;

/**
 * Selbstverwaltung eines Ladens durch den Inhaber: Design (Farben, Hamburger-Menue,
 * Logo, Hintergrundbild) sowie die eigenen Kuechen-Logins. Alles ist auf den
 * Laden des angemeldeten Inhabers beschraenkt.
 */
@Service
public class RestaurantAdminService {

    private static final Logger log = LoggerFactory.getLogger(RestaurantAdminService.class);

    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png");
    /** Logos werden kleiner gehalten als Hintergrundbilder. */
    private static final int LOGO_MAX = 600;
    private static final int BACKGROUND_MAX = 1600;
    /** Ambiente-Fotos sind wie das Hintergrundbild verkleinert (Stimmungsbilder, keine Detailaufnahmen). */
    private static final int GALLERY_MAX = 1600;
    private static final int MAX_GALLERY_IMAGES = 8;

    private final RestaurantRepository restaurantRepository;
    private final RestaurantAssetRepository assetRepository;
    private final RestaurantGalleryImageRepository galleryRepository;
    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public RestaurantAdminService(RestaurantRepository restaurantRepository,
                                  RestaurantAssetRepository assetRepository,
                                  RestaurantGalleryImageRepository galleryRepository,
                                  AppUserRepository userRepository,
                                  PasswordEncoder passwordEncoder) {
        this.restaurantRepository = restaurantRepository;
        this.assetRepository = assetRepository;
        this.galleryRepository = galleryRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ---------- Design ----------

    /** Design des eigenen Ladens (Inhaber-Ansicht). */
    @Transactional(readOnly = true)
    public RestaurantThemeDto getDesign() {
        return buildTheme(findRestaurant(CurrentUser.restaurantId()));
    }

    /** Oeffentliches Design eines Ladens (Gaeste-Seite, ohne Login). */
    @Transactional(readOnly = true)
    public RestaurantThemeDto getPublicTheme(Long restaurantId) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .filter(Restaurant::isActive)
                .orElseThrow(() -> new NotFoundException("Laden nicht gefunden."));
        return buildTheme(restaurant);
    }

    @Transactional
    public RestaurantThemeDto updateDesign(DesignRequest request) {
        Restaurant restaurant = findRestaurant(CurrentUser.restaurantId());
        restaurant.setAccentColor(request.accentColor());
        restaurant.setBackgroundColor(request.backgroundColor());
        // Die Achse categoryStyle fuehrt, der aeltere Schalter wird
        // mitgezogen - beide bleiben dadurch immer konsistent. Alte Clients
        // ohne die Achse landen ueber categoryStyleOrDefault() wieder auf
        // ihrem eigenen Schalter (siehe DesignRequest).
        String categoryStyle = request.categoryStyleOrDefault();
        restaurant.setCategoryStyle(categoryStyle);
        restaurant.setCategoriesAsHamburger("HAMBURGER".equals(categoryStyle));
        restaurant.setKitchenDisplayEnabled(request.kitchenEnabledOrDefault());
        restaurant.setStyleShape(request.styleShapeOrDefault());
        restaurant.setDisplayFont(request.displayFontOrDefault());
        restaurant.setCartFlyStyle(request.cartFlyStyleOrDefault());
        restaurant.setOrderConfirmStyle(request.orderConfirmStyleOrDefault());
        restaurant.setDarkMode(request.darkModeOrDefault());
        restaurant.setIntroStyle(request.introStyleOrDefault());
        restaurant.setIntroText(request.introText());
        restaurant.setIntroSpeed(request.introSpeedOrDefault());
        restaurant.setInstagramUrl(request.instagramUrl());
        restaurant.setFacebookUrl(request.facebookUrl());
        restaurant.setWebsiteUrl(request.websiteUrl());
        restaurant.setBackgroundColor2(request.backgroundColor2());
        restaurant.setOpeningHours(request.openingHours());
        restaurant.setAddress(request.address());
        restaurant.setPhone(request.phone());
        restaurant.setMenuLayout(request.menuLayoutOrDefault());
        restaurant.setHeroStyle(request.heroStyleOrDefault());
        restaurant.setTextureStyle(request.textureStyleOrDefault());
        restaurant.setControlStyle(request.controlStyleOrDefault());
        restaurant.setMotionLevel(request.motionLevelOrDefault());
        // introColor bewusst OHNE Standardwert: leer heisst "keine eigene
        // Farbe", der Vorhang nimmt dann den Akzent (siehe Restaurant).
        restaurant.setIntroColor(request.introColor());
        restaurant.setIntroLogo(request.introLogoOrDefault());
        restaurant.setIntroHold(request.introHoldOrDefault());
        restaurant.setIntroRepeat(request.introRepeatOrDefault());
        return buildTheme(restaurant);
    }

    // ---------- Logo / Hintergrundbild ----------

    @Transactional
    public void saveAsset(AssetKind kind, MultipartFile file) {
        Long rid = CurrentUser.restaurantId();
        validateUpload(file);
        boolean png = "image/png".equalsIgnoreCase(file.getContentType());
        int max = kind == AssetKind.LOGO ? LOGO_MAX : BACKGROUND_MAX;
        byte[] encoded;
        try {
            encoded = resizeAndReencode(file.getBytes(), png, max);
        } catch (IOException e) {
            throw new BadRequestException("Bild konnte nicht gelesen werden.");
        }
        String storedType = png ? "image/png" : "image/jpeg";
        assetRepository.findByRestaurantIdAndKind(rid, kind)
                .ifPresentOrElse(
                        existing -> existing.update(storedType, encoded),
                        () -> assetRepository.save(new RestaurantAsset(rid, kind, storedType, encoded)));
        log.info("{} fuer Laden {} gespeichert ({} Bytes)", kind, rid, encoded.length);
    }

    @Transactional
    public void deleteAsset(AssetKind kind) {
        // Bewusst laden + loeschen (statt derived delete), damit das Entfernen
        // zuverlaessig sofort greift und die Aenderung committet wird.
        assetRepository.findByRestaurantIdAndKind(CurrentUser.restaurantId(), kind)
                .ifPresent(assetRepository::delete);
    }

    /** Bild eines Ladens ausliefern (Gaeste-Seite, ohne Login). */
    @Transactional(readOnly = true)
    public RestaurantAsset getAsset(Long restaurantId, AssetKind kind) {
        return assetRepository.findByRestaurantIdAndKind(restaurantId, kind)
                .orElseThrow(() -> new NotFoundException("Kein Bild vorhanden."));
    }

    // ---------- Bildergalerie (Ambiente-/Stimmungsfotos, getrennt von Gericht-Fotos) ----------

    /** Ids der Galerie-Bilder in Anlegereihenfolge - ohne Login (Gast) UND fuer die eigene Verwaltung nutzbar. */
    @Transactional(readOnly = true)
    public List<Long> getGalleryImageIds(Long restaurantId) {
        return galleryRepository.findIdsByRestaurantId(restaurantId);
    }

    @Transactional
    public void addGalleryImage(MultipartFile file) {
        Long rid = CurrentUser.restaurantId();
        if (galleryRepository.countByRestaurantId(rid) >= MAX_GALLERY_IMAGES) {
            throw new BadRequestException("Es sind bereits %d Fotos in der Galerie - erst eins entfernen.".formatted(MAX_GALLERY_IMAGES));
        }
        validateUpload(file);
        boolean png = "image/png".equalsIgnoreCase(file.getContentType());
        byte[] encoded;
        try {
            encoded = resizeAndReencode(file.getBytes(), png, GALLERY_MAX);
        } catch (IOException e) {
            throw new BadRequestException("Bild konnte nicht gelesen werden.");
        }
        galleryRepository.save(new RestaurantGalleryImage(rid, png ? "image/png" : "image/jpeg", encoded));
    }

    @Transactional
    public void deleteGalleryImage(Long imageId) {
        galleryRepository.findByIdAndRestaurantId(imageId, CurrentUser.restaurantId())
                .ifPresent(galleryRepository::delete);
    }

    /** Ein Galerie-Bild ausliefern (Gaeste-Seite, ohne Login). */
    @Transactional(readOnly = true)
    public RestaurantGalleryImage getGalleryImage(Long imageId) {
        return galleryRepository.findById(imageId)
                .orElseThrow(() -> new NotFoundException("Kein Bild vorhanden."));
    }

    // ---------- Mitarbeiter-Logins (Kueche + Service) ----------

    @Transactional(readOnly = true)
    public List<StaffUserDto> listStaffUsers() {
        return userRepository
                .findByRestaurantIdAndRoleInOrderByRoleAscUsernameAsc(
                        CurrentUser.restaurantId(), List.of(UserRole.KITCHEN, UserRole.SERVICE))
                .stream()
                .map(StaffUserDto::from)
                .toList();
    }

    @Transactional
    public StaffUserDto createStaffUser(CreateUserRequest request) {
        UserRole role = request.roleOrDefault();
        if (role == UserRole.OWNER) {
            throw new ConflictException("Ueber diese Verwaltung koennen nur Kueche- und Service-Logins angelegt werden.");
        }
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new ConflictException("Benutzername '%s' ist bereits vergeben.".formatted(request.username()));
        }
        Restaurant restaurant = findRestaurant(CurrentUser.restaurantId());
        AppUser user = new AppUser(
                request.username(),
                passwordEncoder.encode(request.password()),
                role,
                restaurant);
        userRepository.save(user);
        return StaffUserDto.from(user);
    }

    @Transactional
    public StaffUserDto updateStaffUser(Long id, UpdateUserRequest request) {
        AppUser user = findOwnStaffUser(id);
        if (request.active() != null) {
            user.setActive(request.active());
        }
        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        return StaffUserDto.from(user);
    }

    @Transactional
    public void deleteStaffUser(Long id) {
        userRepository.delete(findOwnStaffUser(id));
    }

    // ---------- Hilfsmethoden ----------

    private AppUser findOwnStaffUser(Long id) {
        AppUser user = userRepository.findByIdAndRestaurantId(id, CurrentUser.restaurantId())
                .orElseThrow(() -> new NotFoundException("Benutzer %d nicht gefunden.".formatted(id)));
        if (user.getRole() == UserRole.OWNER) {
            throw new ConflictException("Der Inhaber-Login kann hier nicht verwaltet werden.");
        }
        return user;
    }

    private Restaurant findRestaurant(Long id) {
        return restaurantRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Laden %d nicht gefunden.".formatted(id)));
    }

    private RestaurantThemeDto buildTheme(Restaurant restaurant) {
        Set<AssetKind> kinds = Set.copyOf(assetRepository.findKinds(restaurant.getId()));
        String base = "/api/guest/restaurants/" + restaurant.getId();
        return new RestaurantThemeDto(
                restaurant.getId(),
                restaurant.getName(),
                restaurant.getAccentColor(),
                restaurant.getBackgroundColor(),
                restaurant.isCategoriesAsHamburger(),
                restaurant.isKitchenDisplayEnabled(),
                kinds.contains(AssetKind.LOGO) ? base + "/logo" : null,
                kinds.contains(AssetKind.BACKGROUND) ? base + "/background" : null,
                restaurant.getStyleShape(),
                restaurant.getDisplayFont(),
                restaurant.getCartFlyStyle(),
                restaurant.getOrderConfirmStyle(),
                restaurant.isDarkMode(),
                restaurant.getIntroStyle(),
                restaurant.getIntroText(),
                restaurant.getInstagramUrl(),
                restaurant.getFacebookUrl(),
                restaurant.getWebsiteUrl(),
                restaurant.getBackgroundColor2(),
                restaurant.getIntroSpeed(),
                restaurant.getOpeningHours(),
                restaurant.getAddress(),
                restaurant.getPhone(),
                restaurant.getMenuLayout(),
                restaurant.getHeroStyle(),
                restaurant.getTextureStyle(),
                restaurant.getControlStyle(),
                restaurant.getCategoryStyle(),
                restaurant.getMotionLevel(),
                restaurant.getIntroColor(),
                restaurant.getIntroLogo(),
                restaurant.getIntroHold(),
                restaurant.getIntroRepeat());
    }

    private void validateUpload(MultipartFile file) {
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
    }

    /** Verkleinert auf maximal 'max' Pixel Kantenlaenge und kodiert das Bild neu. */
    private static byte[] resizeAndReencode(byte[] original, boolean png, int max) throws IOException {
        BufferedImage source = ImageIO.read(new ByteArrayInputStream(original));
        if (source == null) {
            throw new BadRequestException("Datei ist kein lesbares Bild.");
        }
        int width = source.getWidth();
        int height = source.getHeight();
        int longest = Math.max(width, height);
        double factor = longest > max ? max / (double) longest : 1.0;
        int newWidth = Math.max(1, (int) Math.round(width * factor));
        int newHeight = Math.max(1, (int) Math.round(height * factor));

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
