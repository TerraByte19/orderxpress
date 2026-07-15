# OrderXpress – Projektkontext für Claude

QR-Bestellsystem für ein Restaurant. Diese Datei ist die Übergabe an neue
Chat-Sitzungen: Stand, Entscheidungen, offene Punkte. Der User (Adham) ist
Einsteiger – Erklärungen einfach halten, auf Deutsch antworten.

## Fachlicher Ablauf (Kern der App)

1. Jeder Tisch hat einen QR-Code (Inhalt: `<public-base-url>/t/<qrToken>`, geheimer UUID-Token, NICHT die Tischnummer).
2. Gast scannt → `POST /api/guest/scan/{qrToken}` → Tisch-Sitzung mit Status PENDING.
3. Inhaber bekommt live (SSE) die Meldung **„Tisch Nr. X freigeben?"** und genehmigt/lehnt ab (Absicherung gegen Fremd-Scans).
4. Nach Freigabe (APPROVED): Gast sieht Menü, bestellt mit seinem `sessionToken`.
5. Bestellung geht live an die Küche (SSE) und wird als Bon gedruckt (ESC/POS).
6. Inhaber beendet die Sitzung (`close`) → Tisch wieder frei.

## Stack & wichtige Versionsentscheidungen

- **Spring Boot 4.1.0** (Parent-POM), **Java 17**, Maven. User baut lokal in PowerShell/IntelliJ; die Cowork-Sandbox hat KEINEN Zugriff auf Maven Central (nicht dort bauen, Versionen stattdessen per web_fetch auf repo.maven.apache.org verifizieren).
- Boot-4-Fallstricke (bereits berücksichtigt, bei neuem Code beachten):
  - `spring-boot-starter-web` ist deprecated → wir nutzen **`spring-boot-starter-webmvc`**.
  - `@AutoConfigureMockMvc` liegt jetzt in **`org.springframework.boot.webmvc.test.autoconfigure`** und braucht die Test-Dependency **`spring-boot-webmvc-test`**.
  - **Jackson 3**: KEINE direkten `com.fasterxml.jackson`-Imports verwenden (Records + jakarta-Validation reichen).
  - JUnit 6 (Pakete `org.junit.jupiter` unverändert), Hibernate 7, Security 7 (nur Lambda-DSL).
- H2 dateibasiert (`./data/`), `ddl-auto: update`. springdoc-openapi **3.0.3** (3.x = Boot-4-Linie), ZXing 3.5.4 für QR-PNGs.

## Architektur (Paket `com.orderxpress`)

- `domain`: RestaurantTable, TableSession (PENDING/APPROVED/REJECTED/EXPIRED/CLOSED), MenuCategory, MenuItem, CustomerOrder (NEW→IN_PREPARATION→READY→SERVED, CANCELLED; „Order" ist SQL-reserviert), OrderItem (Name/Preis-Schnappschuss).
- `service`: TableSessionService (Scan/Freigabe/Abklingzeit), OrderService (Preise NUR serverseitig, Statusübergangs-Map), MenuService, AdminCatalogService (CRUD), PrintService (@Async), QrCodeService, SseHub (SSE an Inhaber+Küche, Heartbeat 25s), DomainEventListener (**@TransactionalEventListener AFTER_COMMIT** – SSE/Druck erst nach DB-Commit).
- `service.printing`: ReceiptPrinter-Interface; LoggingReceiptPrinter (mode=log) / EscPosNetworkPrinter (mode=network, Port 9100, CP858, Tischnummer doppelt groß). Druckfehler bricht NIE die Bestellung ab → `printed`/`printError` an der Bestellung, Küche kann nachdrucken.
- `web`: GuestController (öffentlich), AdminController (Rolle OWNER), KitchenController (OWNER+KITCHEN), GlobalExceptionHandler (ProblemDetail, deutsche Meldungen).
- **Multi-Store (seit 12.07.2026):** Die App ist eine PLATTFORM mit mehreren Läden. Jeder `Restaurant`-Datensatz hat eigene Tische/Kategorien/Gerichte/Sitzungen/Bestellungen und Design. `RestaurantTable` und `MenuCategory` tragen `restaurant_id` (Unique jetzt PRO Laden: Tischnummer bzw. Kategoriename); `MenuItem` erbt den Laden über die Kategorie; Sitzungen/Bestellungen über den Tisch. Mandanten-Trennung läuft über `CurrentUser.restaurantId()` (aus dem `StoreUserDetails`-Principal) - Services filtern ALLE Queries darauf. SSE ist je Laden getrennt (SseHub-Maps nach restaurantId; DomainEvents tragen `restaurantId`).
- Security: Basic Auth, stateless, CSRF aus. **Plattform-Admin** aus `application.yml` (`orderxpress.security.platform-admin`, `{noop}`/`{bcrypt}`) - legt Läden an (`/api/platform/**`, Rolle PLATFORM_ADMIN, Seite `/platform.html`). **Inhaber/Küche** liegen in der DB (`app_users`, BCrypt) mit Laden-Zuordnung; `StoreUserDetailsService` lädt beide Quellen. Der Inhaber legt seine Küchen-Logins selbst an (`/api/admin/users`). Gast-Schutz über geheime Tokens + Freigabe. Spam-Schutz: 5 Min Abklingzeit nach Ablehnung.
- Swagger UI: `/swagger-ui.html` (Authorize-Button für Basic Auth). H2-Konsole: `/h2-console`. Beide permitAll → vor Produktion sperren.

## Konventionen

Bezeichner Englisch, Kommentare/Fehlermeldungen Deutsch (ASCII-Umschreibung ue/oe/ae in Java-Dateien). DTOs als Records, keine Entities nach außen. `open-in-view: false`, EntityGraph/join fetch gegen N+1.

## Status

**Fertig:** komplettes Backend, am 11.07.2026 vollständig grün getestet (test-api.ps1: 33/33 bestanden), Integrationstests (OrderFlow + Security), Code-Review, Swagger, PowerShell-Testscript `test-api.ps1` (im Projekt-Root, testet den ganzen Ablauf gegen die laufende App). Beispieldaten beim ersten Start (8 Tische, Speisekarte). **Frontend V1** unter `src/main/resources/static`: `guest.html` (+`js/guest.js`, Route `/t/{qrToken}` via PageController-Forward), `admin.html` (Login, Freigabe-Anfragen live, Tische mit QR-Overlay/Gast-Link/Sitzung-beenden, Bestellliste), `kitchen.html` (3-Spalten-Board, Statuswechsel, Storno, Nachdruck), gemeinsames `css/app.css` + `js/api.js`. Gelöste Stolperfalle: Browser-EventSource kann kein Basic Auth → eigener SSE-Client über fetch-Stream mit Authorization-Header (`OX.connectSse`), Login-Daten im sessionStorage. `TableDto` hat dafür `currentSessionId` bekommen.

**Neu (11.07.2026):** Speisekarten-Verwaltung KOMPLETT im Inhaber-Frontend (Kategorien + Gerichte anlegen/bearbeiten/löschen, Verfügbarkeits-Toggle) inkl. **Fotos**: Upload JPG/PNG max 5MB, wird serverseitig auf 1000px verkleinert + neu kodiert (MenuImageService, ImageIO), Ablage als BLOB in eigener Tabelle `menu_item_images` (Id = menu_item_id, damit Karten-Queries schlank bleiben), Auslieferung über `GET /api/guest/menu-items/{id}/image` (10 Min Cache), `imageUrl` in MenuItemDto/MenuItemAdminDto. Tisch-Verwaltung im Frontend (anlegen mit Auto-Nummer, bearbeiten, aktiv-Schalter, löschen). Neue Testklasse MenuImageIntegrationTest. BadRequestException + Handler (auch MaxUploadSizeExceeded → 400).

**Neu (11.07.2026, abends):** Detail-Ansicht pro Gericht auf der Gäste-Seite: Zeile antippen → Overlay mit großem Bild, Preis, Kurzbeschreibung und neuem Feld `details` (2000 Zeichen, „Zutaten & Details" für Inhalte/Allergene), plus Mengen-Stepper und Hinweis-Feld direkt im Overlay („+"-Button bleibt für Schnell-Hinzufügen, stopPropagation beachten). `details` wird im Admin über Textarea gepflegt (buildForm kann jetzt type=textarea; toggleAvailable MUSS details mitschicken, sonst Datenverlust). Beispieldaten enthalten Muster-Details mit Allergenen.

**Neu (12.07.2026): Umbau zur Multi-Store-Plattform + Design pro Laden.**
- **Domäne:** neue Entities `Restaurant` (Name/slug/active + Design: accentColor, backgroundColor, categoriesAsHamburger), `RestaurantAsset` (Logo/Hintergrund als BLOB, eigene Tabelle, unique restaurant_id+kind), `AppUser` (username/passwordHash/role OWNER|KITCHEN/restaurant/active), Enum `UserRole`, `AssetKind`. `RestaurantTable`/`MenuCategory` mit `restaurant_id` (+ Unique-Constraints pro Laden), Konstruktoren erweitert.
- **Security:** `application.yml` hat statt owner/kitchen nur noch `security.platform-admin`. `StoreUserDetails`/`StoreUserDetailsService`/`CurrentUser` unter `config.security`. SecurityConfig: nur PasswordEncoder-Bean + einzige UserDetailsService-Bean → Boot verdrahtet DaoAuthenticationProvider selbst (kein expliziter Provider-Bean, vermeidet Security-7-API-Fallen).
- **Services:** `PlatformService` (Läden CRUD + ersten Inhaber anlegen), `RestaurantAdminService` (Design, Logo/Hintergrund-Upload mit ImageIO-Verkleinern: Logo 600px, Hintergrund 1600px; Küchen-User-CRUD). Alle bestehenden Services (Menu/AdminCatalog/TableSession/Order/MenuImage) filtern über `CurrentUser.restaurantId()` bzw. beim Gast über qrToken/sessionToken → Laden. Fremde IDs werden bewusst wie „nicht gefunden" behandelt.
- **Controller:** `PlatformController` (`/api/platform/**`), AdminController um `/api/admin/design*` (+Logo/Background-Upload) und `/api/admin/users*` erweitert; GuestController: `/api/guest/menu/{restaurantId}`, `/api/guest/theme/{restaurantId}`, `/api/guest/restaurants/{id}/logo|background`. Scan-Antwort enthält jetzt `restaurantId`+`restaurantName`.
- **Frontend:** neue `platform.html`+`js/platform.js` (Läden anlegen). admin.html: Design-Karte (Farbwähler, Hamburger-Schalter, Logo/Hintergrund-Upload) + Küchen-Login-Karte. guest.js: lädt Theme nach Scan, setzt CSS-Variablen `--primary`/`--bg`, Logo, Hintergrundbild; Kategorien optional als Hamburger-Menü (cat-bar/cat-panel). app.css um Theming/Hamburger/Logo ergänzt.
- **Demo-Zugänge (DataInitializer, nur bei leerer DB):** Plattform-Admin `admin`/`admin123` (aus yml), Inhaber `inhaber`/`inhaber123`, Küche `kueche`/`kueche123`, Demo-Laden „Demo-Restaurant" (slug `demo`) mit 8 Tischen + Karte.
- **Tests angepasst:** Login-Passwörter auf DB-Werte (inhaber123/kueche123), Menü-Aufruf auf `/api/guest/menu/{restaurantId}` (restaurantId aus Scan-Antwort), test-yml auf `platform-admin`.

**WICHTIG - DB-Reset nötig:** Der Umbau fügt NOT-NULL-Spalten (`restaurant_id`) zu bestehenden Tabellen hinzu. Auf einer ALTEN Datenbank mit Daten scheitert `ddl-auto: update`. Vor dem ersten Start: App stoppen → Ordner `data/` löschen → starten (DataInitializer legt den Demo-Laden frisch an). Das ist ok, weil noch nichts produktiv läuft.

**Neu (12.07.2026, später): Rolle SERVICE/Kasse, Handy-Zugriff, Hintergrund-Fix.**
- **Rollen jetzt dreistufig:** `UserRole` = OWNER | SERVICE | KITCHEN. Neuer `ServiceController` (`/api/service/**`, Rollen OWNER+SERVICE): Freigabe-Anfragen, approve/reject/close, Tisch-/Bestellübersicht (nur lesen), SSE (gleicher Admin-Kanal). Gedacht für Kellner/Kasse, wenn der Inhaber nicht da ist. Küche unverändert. SecurityConfig-Regel `/api/service/**` ergänzt, `service.html` in Whitelist.
- **Mitarbeiter-Logins mit Rolle:** Inhaber legt Service- UND Küchen-Logins an (`/api/admin/users`, Rolle wählbar). `KitchenUserDto` → `StaffUserDto` (mit role), `CreateUserRequest` um `role` (Default KITCHEN, OWNER verboten). Repo: `findByRestaurantIdAndRoleInOrderByRoleAscUsernameAsc`. Frontend: admin.html-Karte „Mitarbeiter-Logins" mit Rollen-Select; neue `service.html`+`js/service.js` (mobil, große Buttons).
- **Handy-Zugriff:** `AdminCatalogService.baseUrl()` nimmt bei localhost-Konfig automatisch den Request-Host (z.B. http://192.168.x.x:8080) für QR-Codes/Gast-Links → QR funktioniert vom Handy im selben WLAN, ohne Konfiguration. Echte Domain in `public-base-url` wird bevorzugt. (Tomcat lauscht ohnehin auf allen Interfaces; ggf. Windows-Firewall für Port 8080 freigeben.)
- **Hintergrund-Fix:** `deleteAsset` lädt+löscht die Entity (statt derived delete) → Entfernen greift sofort. Gast/Admin cache-busten Logo/Hintergrund-URLs (`?v=timestamp`), damit ersetzte/entfernte Bilder nicht aus dem Browser-Cache hängen bleiben.
- **Demo-Zugänge erweitert:** zusätzlich `service`/`service123` (Rolle SERVICE) im Demo-Laden.

**Offen / nächste Schritte:**
1. Vor echtem Einsatz: Passwörter ändern, H2-Konsole + Swagger sperren, HTTPS, `public-base-url` setzen.
2. Später: PostgreSQL + Flyway (statt `ddl-auto: update`), echten Bondrucker testen (`printer.mode: network` + IP), evtl. Bezahlung.

**Betriebs-Regeln (wichtig, Ursache früherer Probleme):** Es darf nur EINE App-Instanz laufen (Port 8080, `netstat -ano | findstr :8080` prüfen). `data/` NIEMALS löschen, solange eine Instanz läuft – sonst entsteht eine halb kaputte Datenbank. Reset-Reihenfolge: App stoppen → `data/` löschen → starten.

**Lektionen aus der Fehlersuche (nicht wiederholen!):**
1. Dateien, die Claude über den Cowork-Mount schreibt, können ÄLTERE Zeitstempel haben als der letzte Maven-Build → Maven kompiliert sie dann NICHT („Nothing to compile"). Nach Claude-Änderungen immer `mvn clean test` / `mvn clean spring-boot:run`, oder Claude muss die Zeitstempel per `touch` anheben.
2. Windows PowerShell 5.1 hat zwei JSON-Fallen, die wie Backend-Bugs aussehen: (a) `Invoke-RestMethod` liefert JSON-Arrays als „Liste in der Liste“, (b) bei GENAU einem Element fehlt `.Count`. In `test-api.ps1` daher Listen IMMER via `Get-JsonList` holen und beim Zuweisen in `@(...)` wickeln. Diese beiden Fallen haben eine lange Phantom-Fehlersuche verursacht – der Server-Code (`findBySessionIdOrderByCreatedAtDesc` etc.) war nie kaputt.

Details/Beispiel-curls: siehe README.md.
