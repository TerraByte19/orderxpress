# Gäste-Seite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Gäste-Seite auf das neue Design-System umstellen, dabei zwei Abläufe verbessern — der Einstieg wird geglättet, und der Gast sieht den Status seiner Bestellung.

**Architecture:** `guest.html` wird neu geschrieben, `frontend/public/js/guest.js` (689 Zeilen) durch fünf Module unter `frontend/src/pages/guest/` abgelöst. Die Seite ist der **erste Verbraucher von `theme.ts`** — bis hierhin hat noch keine Seite das Laden-Design angewandt. Fachlich bleibt alles erhalten; neu sind nur die zwei Ablauf-Verbesserungen, beide ohne Backend-Änderung.

**Tech Stack:** Vite 6, TypeScript 5 (strict), Vitest, jsdom. Bibliothek aus Plan 1: `api`, `auth`, `session`, `sse`, `theme`, `format`, `ui`, `types`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-frontend-redesign-design.md`, besonders Abschnitt 5 (Gäste-Seite) und Abschnitt 12 (Übergaben). Bei Widerspruch gewinnt die Spec.
- **Branch:** `frontend-redesign`. Nicht auf `main` arbeiten.
- **Kein Backend anfassen.** Kein `.java`, keine `application.yml`, keine `pom.xml`. Beide Verbesserungen kommen ohne aus — das ist geprüft, siehe Aufgaben 3 und 6.
- **Kein Inline-Style, kein `onclick` im HTML.** Ereignisse über `addEventListener` in TypeScript.
- **Keine Datei über ~250 Zeilen.**
- **Keine externen Laufzeit-Aufrufe.**
- **TypeScript strict.** `npm run build` läuft `tsc --noEmit` vorweg.
- **Alle Zahlen in Mono:** Preise, Zeiten, Tischnummern über die Klassen `.ox-preis` / `.ox-zeit` / `.ox-num` bzw. den Helfer `tischmarke()`.
- **Kommentare und Texte auf Deutsch**, echte Umlaute erlaubt (UTF-8).
- **Tests:** Aktuell 63 im Frontend, 120 im Backend. Beide Zahlen dürfen nur wachsen.
- **Betrieb:** Nur eine App-Instanz auf Port 8080. `data/` niemals löschen.
- **Testregel dieses Projekts** — hat schon dreimal Testtheater aufgedeckt: Bevor ein Test als fertig gilt, spiel durch, was er täte, wenn die Implementierung den Fehler hätte. Wird er nicht rot, prüft er nichts. `toContain` auf Klassenlisten oder Strings ist fast immer zu schwach.

---

## Was die Seite fachlich tut

Wer das hier umsetzt, muss den Ablauf kennen — er ist ungewöhnlich:

1. Gast scannt den QR-Code am Tisch, landet auf `/t/{qrToken}`.
2. `POST /api/guest/scan/{qrToken}` legt eine **Person** an und liefert einen `guestToken`. Die **erste** Person am Tisch ist der Gastgeber.
3. Der Tisch selbst muss vom Personal freigegeben werden (Schutz gegen Fremd-Scans vom Nachbartisch oder von der Straße). Bis dahin `sessionStatus = PENDING`.
4. Jede **weitere** Person, die denselben Code scannt, wird nicht vom Personal freigegeben, sondern vom **Gastgeber** am Tisch.
5. Nach Freigabe: Name eingeben, bestellen. Jede Bestellung gehört zu einer Person — dadurch weiß die geteilte Rechnung später, wer was hatte.
6. Die Rechnung zeigt alle Personen am Tisch. Der Gast kann Positionen antippen, um seine Summe zu sehen; kassiert wird an der Kasse.

Der `guestToken` liegt pro QR-Code im `localStorage`. Neuladen heißt: dieselbe Person, nicht eine neue.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `frontend/guest.html` | Gerüst aller Ansichten, ersetzt die alte Fassung |
| `frontend/src/pages/guest/index.ts` | Einstieg: Zustand, Ansichtswechsel, verdrahtet die Module |
| `frontend/src/pages/guest/session.ts` | Scan, Wiederaufnahme, Statusabfrage, Beitritts-Freigabe, Name |
| `frontend/src/pages/guest/menu.ts` | Speisekarte laden und darstellen, Kategorien, Detail-Overlay |
| `frontend/src/pages/guest/cart.ts` | Warenkorb samt Wiederherstellung, Bestellung absenden |
| `frontend/src/pages/guest/orders.ts` | **Neu:** eigene Bestellungen mit Status-Chip |
| `frontend/src/pages/guest/bill.ts` | Geteilte Rechnung mit Auswahl-Summe |
| `frontend/src/pages/guest/guest.css` | Nur was die Bausteine nicht abdecken: Foto-Karten, Kategorie-Leiste |
| `frontend/src/lib/types.ts` | **Erweitern** um Speisekarten- und Rechnungs-Typen |
| Testdateien je Modul | `*.test.ts` neben dem Modul |

**Entfällt am Ende:** `frontend/public/js/guest.js`.

**Bleibt vorerst:** `frontend/public/js/api.js` — die sieben übrigen Alt-Seiten brauchen es.

---

### Task 1: Speisekarten- und Rechnungs-Typen ergänzen

**Files:**
- Modify: `frontend/src/lib/types.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `Gericht` — aus `MenuItemDto`: `id: number`, `name: string`, `description: string | null`, `details: string | null`, `price: number`, `imageUrl: string | null`
  - `Kategorie` — aus `MenuCategoryDto`: `id: number`, `name: string`, `items: Gericht[]`
  - `RechnungsZeile` — aus `BillDto.Line`: `orderItemId: number`, `name: string`, `quantity: number`, `unitPrice: number`, `lineTotal: number`, `note: string | null`, `paid: boolean`
  - `RechnungsPerson` — aus `BillDto.Participant`: `guestId: number`, `name: string`, `isHost: boolean`, `items: RechnungsZeile[]`, `total: number`, `paidTotal: number`, `openTotal: number`
  - `Rechnung` — aus `BillDto`: `tableNumber: number`, `sessionId: number`, `participants: RechnungsPerson[]`, `grandTotal: number`, `paidTotal: number`, `openTotal: number`
  - `BeitrittsAnfrage` — Rückgabe von `GET /guests/{token}/join-requests`; **Feldnamen zuerst am Java-Code prüfen**

- [ ] **Step 1: Java-Records lesen und Felder abgleichen**

```bash
cd /c/OrderXpress
cat src/main/java/com/orderxpress/web/dto/MenuCategoryDto.java
cat src/main/java/com/orderxpress/web/dto/MenuItemDto.java
cat src/main/java/com/orderxpress/web/dto/BillDto.java
grep -n "join-requests" -A 8 src/main/java/com/orderxpress/web/GuestController.java
```

Der Rückgabetyp der Beitritts-Anfragen steht im Controller — verfolge ihn bis zum Record und übernimm die Felder wörtlich.

**Stolperfalle, die in Plan 1 schon einmal zugeschlagen hat:** `ScanResponse` nennt den Namen der Person `guestName`, `GuestStatusResponse` nennt ihn `name`. Beide werden von dieser Seite benutzt. Nicht verwechseln.

- [ ] **Step 2: Typen ergänzen**

An `types.ts` anhängen, im Stil der vorhandenen Einträge (Kommentar mit dem Java-Record-Namen darüber). `BigDecimal` wird als JSON-Zahl übertragen, also `number`.

- [ ] **Step 3: Typprüfung**

```bash
cd /c/OrderXpress/frontend && npx tsc --noEmit
```

Erwartet: keine Ausgabe.

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/lib/types.ts
git commit -m "feat: Speisekarten- und Rechnungs-Typen ergaenzt

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `guest.html` — Gerüst aller Ansichten

Die Seite hat sieben Ansichten, von denen immer genau eine sichtbar ist. Umgeschaltet wird über das `hidden`-Attribut mit `zeigeNur()` aus `ui.ts`.

**Files:**
- Modify: `frontend/guest.html` (vollständig ersetzt)

**Interfaces:**
- Consumes: `app.css`, `fonts.ts`, die Bausteine aus `components.css`
- Produces: die Element-Ids, auf die alle folgenden Aufgaben zugreifen. Lege sie hier fest und weiche später nicht davon ab.

- [ ] **Step 1: Alte Fassung lesen**

```bash
cd /c/OrderXpress && cat frontend/guest.html
```

Sie ist die fachliche Referenz: welche Ansichten es gibt und was in jeder steht. Übernimm die Struktur, nicht die Umsetzung.

- [ ] **Step 2: Neue Fassung schreiben**

Kopfbereich wie bei `frontend/index.html`, **aber ohne** `registriereServiceWorker()` und **ohne** Manifest-Verweis: Gäste sollen die App nicht installieren. Sie scannen den QR-Code und bestellen im Browser. Das ist eine bewusste Festlegung aus der Spec.

Die sieben Ansichten, jede ein Element mit fester Id:

| Id | Zweck |
|---|---|
| `view-wait` | Wartet auf Freigabe durch Personal oder Gastgeber |
| `view-error` | Ungültiger QR-Code, abgelehnt, Sitzung beendet |
| `view-menu` | Speisekarte — **auch schon während des Wartens sichtbar** |
| `view-cart` | Warenkorb |
| `view-orders` | Eigene Bestellungen mit Status |
| `view-bill` | Geteilte Rechnung |
| `view-name` | Namenseingabe |

Dazu, außerhalb der Ansichten:

- Kopfzeile mit Logo-Platz (`brand-logo`), Ladenname und der **Tischmarke** rechts. Die Marke wird von `tischmarke()` erzeugt, nicht von Hand geschrieben.
- Eine Namensleiste (`name-bar`) mit dem eigenen Namen, „Namen ändern", „Kellner rufen", „Rechnung teilen".
- Ein Banner für Beitritts-Anfragen (`join-banner`), das nur der Gastgeber sieht.
- Die Warenkorb-Leiste unten (`cartbar`).
- Ein Overlay für die Gericht-Details.

**Ohne Inline-Style und ohne `onclick`.** Benutz die Bausteine: `.ox-card`, `.ox-btn`, `.ox-field`, `.ox-chip`, `.ox-center`, `.ox-big`, `.ox-muted`, `.ox-overlay`.

- [ ] **Step 3: Bauen und prüfen**

```bash
cd /c/OrderXpress/frontend && npm run build
grep -c 'style="\|onclick=' guest.html
```

Erwartet: Bau erfolgreich, Zähler `0`.

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add frontend/guest.html
git commit -m "feat: Geruest der Gaeste-Seite auf das neue System

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `session.ts` — Scan, Status, Beitritt, Name

Das Herz der Seite. **Hier entsteht die erste der beiden Ablauf-Verbesserungen.**

**Files:**
- Create: `frontend/src/pages/guest/session.ts`, `frontend/src/pages/guest/session.test.ts`

**Interfaces:**
- Consumes: `api` (Plan 1), `ScanAntwort`/`GastStatusAntwort`/`BeitrittsAnfrage` (Task 1)
- Produces:
  - `leseQrToken(): string` — aus `/t/{token}` oder `?t=` als Rückfall für den Entwicklungsbetrieb
  - `scanne(qrToken: string): Promise<ScanAntwort>`
  - `holeStatus(guestToken: string): Promise<GastStatusAntwort>`
  - `starteStatusAbfrage(guestToken, beiAenderung, intervallMs?): { stop(): void }`
  - `setzeName(guestToken: string, name: string): Promise<void>`
  - `holeBeitrittsAnfragen(guestToken: string): Promise<BeitrittsAnfrage[]>`
  - `entscheideBeitritt(guestToken: string, joinerId: number, aktion: "approve" | "reject"): Promise<void>`
  - `rufeKellner(guestToken: string): Promise<void>`
  - `merkeToken(qrToken, guestToken)` / `geleseneToken(qrToken)` — `localStorage` unter `ox-guest-<qrToken>`

**Die Verbesserung: der Einstieg wird geglättet.**

Heute läuft es so: Scan → leerer Wartebildschirm → nach Freigabe Namenseingabe → erst dann die Speisekarte. Drei Hürden hintereinander, und der Gast sitzt vor einer leeren Seite, während das Personal noch beschäftigt ist.

Neu: Direkt nach dem Scan **ist die Speisekarte sichtbar und durchblätterbar.** Der Bestellknopf ist gesperrt und trägt den Hinweis, dass der Tisch noch freigegeben wird. Die Namenseingabe erscheint als ruhige Leiste darüber und kann während des Wartens erledigt werden. Kommt die Freigabe, entsperrt sich das Bestellen **ohne Seitenwechsel**.

Das geht ohne Backend-Änderung, weil `ScanResponse` das Feld `restaurantId` bereits bei `sessionStatus = PENDING` liefert — `GET /api/guest/menu/{restaurantId}` kann also sofort geladen werden. **Prüf das im Java-Code nach, bevor du darauf baust.**

Die Namenspflicht bleibt fachlich bestehen; sie wird nur zeitlich vorgezogen statt nachgelagert.

- [ ] **Step 1: Endpunkte und Feldnamen am Backend prüfen**

```bash
cd /c/OrderXpress
sed -n '70,155p' src/main/java/com/orderxpress/web/GuestController.java
cat src/main/java/com/orderxpress/web/dto/ScanResponse.java
```

Halte fest: Liefert `ScanResponse` die `restaurantId` auch bei `PENDING`? Das ist die Voraussetzung der ganzen Verbesserung.

- [ ] **Step 2: Alte Umsetzung als fachliche Referenz lesen**

```bash
cd /c/OrderXpress && sed -n '85,240p' frontend/public/js/guest.js
```

Dort stehen `scan`, `resume`, `applyScan`, `applyStatus`, `afterStatus`, `startPolling`. Übernimm das **Verhalten**, nicht den Aufbau. Achte besonders darauf, welche Statuskombinationen zu welcher Ansicht führen — das ist mehr als „freigegeben ja/nein": Sitzung und Person haben je einen eigenen Status, und ein abgelehnter Beitretender muss etwas anderes sehen als ein abgelehnter Tisch.

- [ ] **Step 3: Tests schreiben**

Deck ab:
- `leseQrToken` liest aus `/t/<token>` und aus `?t=<token>`, dekodiert korrekt, liefert leer wenn nichts da ist.
- Die Statusabfrage ruft in ihrem Takt erneut ab und meldet **nur bei Änderung**.
- Sie **pausiert, wenn die Seite in den Hintergrund geht** (`visibilitychange`) und läuft danach weiter. Das spart Akku am Gästehandy und ist neu gegenüber der alten Fassung.
- `stop()` beendet sie wirklich.
- Der gemerkte Token hängt am QR-Code: zwei verschiedene QR-Codes teilen sich keinen Token.

Für jeden Test: durchspielen, ob er rot würde, wenn die Logik fehlte.

- [ ] **Step 4: Tests laufen lassen — müssen fehlschlagen**

```bash
cd /c/OrderXpress/frontend && npm test
```

Erwartet: FAIL, Modul nicht auflösbar.

- [ ] **Step 5: `session.ts` schreiben**

Der Takt der Statusabfrage ist **3000 ms** — derselbe wie in der alten Fassung (`guest.js`, `pollTimer`). Nicht ändern, das Backend ist darauf ausgelegt.

- [ ] **Step 6: Tests laufen lassen — müssen bestehen**

```bash
cd /c/OrderXpress/frontend && npm test && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/pages/guest/session.ts frontend/src/pages/guest/session.test.ts
git commit -m "feat: Sitzungs-Logik der Gaeste-Seite

Statusabfrage pausiert jetzt, wenn die Seite im Hintergrund liegt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `menu.ts` — Speisekarte, Kategorien, Detail-Overlay

**Files:**
- Create: `frontend/src/pages/guest/menu.ts`, `frontend/src/pages/guest/menu.test.ts`, `frontend/src/pages/guest/guest.css`

**Interfaces:**
- Consumes: `api`, `preis` (aus `format`), `el` (aus `ui`), `Kategorie`/`Gericht` (Task 1)
- Produces:
  - `ladeSpeisekarte(restaurantId: number): Promise<Kategorie[]>`
  - `zeichneSpeisekarte(kategorien, ziel, beiAuswahl, bestellenErlaubt): void`
  - `oeffneDetail(gericht, beiHinzufuegen, bestellenErlaubt): void`
  - `setzeBestellenErlaubt(erlaubt: boolean): void` — entsperrt nach der Freigabe, **ohne neu zu zeichnen**

**Optik — das ist die Seite, für die das ganze Design-System gebaut wurde.** Aus der Spec, Abschnitt 5:

- Foto-Karten mit 16:9-Bild. Gericht ohne Bild bekommt eine ruhige Fläche, keinen Platzhalter mit Symbol.
- Gerichtname in **Fraunces** (`--ox-font-display`), Beschreibung in Instrument Sans, Preis in **Plex Mono** über `.ox-preis`.
- Haarlinien-Rahmen statt Schatten.
- Kategorie-Reiter klein und gesperrt (Großbuchstaben, weite Buchstabenabstände), nicht fett.
- Akzentfarbe **nur** am Hinzufügen-Knopf und am aktiven Reiter.
- Der Laden kann Kategorien stattdessen als Hamburger-Menü anzeigen lassen (`categoriesAsHamburger` aus dem Theme) — beide Wege müssen funktionieren.

Bilder brauchen `loading="lazy"` und eine feste Höhe über das Seitenverhältnis, damit die Seite beim Nachladen nicht springt.

- [ ] **Step 1: Alte Umsetzung lesen**

```bash
cd /c/OrderXpress && sed -n '309,460p' frontend/public/js/guest.js
```

`loadMenu`, `renderMenu`, `openDetail` — fachliche Referenz für den Inhalt des Detail-Overlays (großes Bild, Preis, Kurzbeschreibung, Feld „Zutaten & Details", Mengen-Stepper, Hinweisfeld).

- [ ] **Step 2: Tests schreiben**

Der Schwerpunkt liegt auf dem, was still falsch sein kann:
- Eine Kategorie ohne Gerichte erscheint nicht als leere Überschrift.
- Ein Gericht ohne Bild erzeugt kein kaputtes `<img>` mit leerem `src`.
- Der Preis wird über `preis()` formatiert, nicht selbst zusammengebaut — prüf das an einem Betrag, bei dem sich beide Wege unterscheiden würden.
- `setzeBestellenErlaubt(false)` sperrt **alle** Hinzufügen-Knöpfe; `true` entsperrt sie wieder, ohne dass die Liste neu gezeichnet wird (sonst verliert der Gast seine Scrollposition mitten im Warten).
- Gerichtnamen werden über `textContent` gesetzt: ein Name mit `<` oder `&` darf keine Auszeichnung erzeugen. **Prüf das mit einem Namen, der Markup enthielte** — anders als bei Zahlen ist der Unterschied hier real.

- [ ] **Step 3: Rot, dann Implementierung, dann grün**

```bash
cd /c/OrderXpress/frontend && npm test
```

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add frontend/src/pages/guest/menu.ts frontend/src/pages/guest/menu.test.ts frontend/src/pages/guest/guest.css
git commit -m "feat: Speisekarte der Gaeste-Seite als Foto-Karten

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `cart.ts` — Warenkorb und Bestellung

**Files:**
- Create: `frontend/src/pages/guest/cart.ts`, `frontend/src/pages/guest/cart.test.ts`

**Interfaces:**
- Consumes: `api`, `preis`, `Gericht`
- Produces:
  - `class Warenkorb` mit `hinzufuegen(gericht, menge, hinweis)`, `aendereMenge(gerichtId, delta)`, `entferne(gerichtId)`, `zeilen()`, `anzahl()`, `summe()`, `leeren()`
  - `sichere(guestToken)` / `stelleWiederHer(guestToken, kategorien)` — `localStorage` unter `ox-cart-<guestToken>`
  - `bestelle(guestToken, warenkorb): Promise<void>`

**Wichtig beim Wiederherstellen:** Gespeichert werden nur Id, Menge und Hinweis — **nicht** Name und Preis. Beim Wiederherstellen werden sie aus der frisch geladenen Speisekarte nachgeschlagen. Grund: Hat der Laden zwischenzeitlich den Preis geändert oder das Gericht entfernt, darf der Warenkorb keine veralteten Werte zeigen. Ein Gericht, das es nicht mehr gibt, fällt beim Wiederherstellen still heraus.

Der Preis wird ohnehin **serverseitig** bestimmt; der Warenkorb zeigt ihn nur an.

- [ ] **Step 1: Alte Umsetzung lesen**

```bash
cd /c/OrderXpress && sed -n '62,84p;441,558p' frontend/public/js/guest.js
```

- [ ] **Step 2: Tests schreiben**

- Dasselbe Gericht zweimal mit **demselben** Hinweis wird zu einer Zeile mit Menge 2.
- Dasselbe Gericht mit **verschiedenen** Hinweisen bleibt zwei Zeilen. (Sonst verliert die Küche die Sonderwünsche.)
- Menge auf 0 entfernt die Zeile.
- Die Summe stimmt bei mehreren Zeilen und Mengen.
- Wiederherstellen: ein Gericht, das nicht mehr in der Karte ist, fällt heraus; die übrigen behalten Menge und Hinweis; **Name und Preis kommen aus der neuen Karte, nicht aus dem Speicher** — prüf das, indem du beim Speichern einen anderen Preis unterschiebst.
- Nach erfolgreicher Bestellung ist der Warenkorb leer und der Speicher geräumt.

- [ ] **Step 3: Rot, Implementierung, grün, Commit**

```bash
cd /c/OrderXpress
git add frontend/src/pages/guest/cart.ts frontend/src/pages/guest/cart.test.ts
git commit -m "feat: Warenkorb der Gaeste-Seite

Wiederherstellung schlaegt Name und Preis in der frischen Speisekarte nach,
statt sie aus dem Speicher zu uebernehmen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `orders.ts` — Bestell-Status für den Gast

**Die zweite Ablauf-Verbesserung.** Heute erfährt der Gast nach dem Absenden nichts mehr.

**Files:**
- Create: `frontend/src/pages/guest/orders.ts`, `frontend/src/pages/guest/orders.test.ts`

**Interfaces:**
- Consumes: `api`, `preis`, `zeit`, `Bestellung`/`BestellStatus` (Plan 1)
- Produces:
  - `holeMeineBestellungen(guestToken: string): Promise<Bestellung[]>`
  - `statusText(status: BestellStatus): string`
  - `statusKlasse(status: BestellStatus): string`
  - `zeichneBestellungen(bestellungen, ziel): void`

**Ohne Backend-Änderung möglich**, weil `GET /api/guest/guests/{token}/orders` bereits `OrderResponse` samt `status` liefert. Prüf das nach:

```bash
cd /c/OrderXpress && grep -n "guests/{guestToken}/orders" -A 6 src/main/java/com/orderxpress/web/GuestController.java
```

Die Anzeige hängt sich an die **bestehende** Statusabfrage aus Task 3 (3000 ms) — **kein zweiter Takt.**

Statusstufen und ihre Anzeige:

| Status | Text | Chip |
|---|---|---|
| `NEW` | Angenommen | neutral |
| `IN_PREPARATION` | In der Küche | Warnfarbe |
| `READY` | Fertig | Erfolgsfarbe |
| `SERVED` | Serviert | neutral, gedämpft |
| `CANCELLED` | Storniert | Gefahrfarbe |

Je Bestellung: Uhrzeit über `.ox-zeit`, Summe über `.ox-preis`, darunter die Positionen.

- [ ] **Step 1: Tests schreiben**

- Jeder der fünf Status ergibt den richtigen Text und die richtige Chip-Klasse. Prüf über `classList.contains`, nicht über Teilzeichenketten.
- Eine stornierte Bestellung ist als solche erkennbar und zählt nicht in eine Gesamtsumme.
- Leere Liste erzeugt eine ruhige Meldung, keine leere Fläche.
- Reihenfolge: neueste zuerst.

- [ ] **Step 2: Rot, Implementierung, grün, Commit**

```bash
cd /c/OrderXpress
git add frontend/src/pages/guest/orders.ts frontend/src/pages/guest/orders.test.ts
git commit -m "feat: Bestell-Status fuer den Gast

Der Gast sieht jetzt, wo seine Bestellung steht. Nutzt den vorhandenen
Endpunkt und den bestehenden Abfrage-Takt, kein Backend-Eingriff.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `bill.ts` — geteilte Rechnung

**Files:**
- Create: `frontend/src/pages/guest/bill.ts`, `frontend/src/pages/guest/bill.test.ts`

**Interfaces:**
- Consumes: `api`, `preis`, `Rechnung`/`RechnungsPerson`/`RechnungsZeile` (Task 1)
- Produces:
  - `holeRechnung(guestToken: string): Promise<Rechnung>`
  - `zeichneRechnung(rechnung, ziel, beiAuswahl): void`
  - `class Auswahl` mit `umschalten(orderItemId, betrag)`, `summe()`, `leeren()`, `enthaelt(orderItemId)`

Der Gast **sieht** hier nur und wählt aus, um seine Summe zu erkennen. Kassiert wird an der Kasse — die Auswahl wird nicht ans Backend geschickt.

**Bereits bezahlte Positionen sind nicht auswählbar** und deutlich als bezahlt gekennzeichnet.

Alle Beträge über `.ox-preis`, also in Mono mit `tabular-nums` — dadurch fluchten die Spalten der Personen untereinander. Das ist der Grund, warum die Schrift so gewählt wurde; hier zahlt es sich aus.

- [ ] **Step 1: Alte Umsetzung lesen**

```bash
cd /c/OrderXpress && sed -n '580,689p' frontend/public/js/guest.js
```

- [ ] **Step 2: Tests schreiben**

- Personen und ihre Positionen werden vollständig dargestellt; der Gastgeber ist erkennbar.
- Eine bezahlte Position lässt sich **nicht** auswählen — prüf, dass ein Klick darauf die Summe nicht ändert.
- Die Auswahl-Summe stimmt über mehrere Personen hinweg.
- `leeren()` setzt zurück, auch in der Anzeige.
- Beträge erscheinen über `.ox-preis`.

- [ ] **Step 3: Rot, Implementierung, grün, Commit**

```bash
cd /c/OrderXpress
git add frontend/src/pages/guest/bill.ts frontend/src/pages/guest/bill.test.ts
git commit -m "feat: geteilte Rechnung der Gaeste-Seite

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `index.ts` — alles verdrahten, Theme anwenden

Die Klammer. **Hier wird `theme.ts` zum ersten Mal überhaupt benutzt.**

**Files:**
- Create: `frontend/src/pages/guest/index.ts`
- Delete: `frontend/public/js/guest.js`

**Interfaces:**
- Consumes: alle Module aus Task 3-7, `setzeLadenDesign` (Plan 1), `tischmarke`/`zeigeNur`/`toast` (Plan 1), `LadenTheme`
- Produces: nichts — Endpunkt der Kette

**Das Laden-Design anwenden.** Nach dem Scan liefert `GET /api/guest/theme/{restaurantId}` das `RestaurantThemeDto`: Akzentfarbe, Hintergrundfarbe, Logo, Hintergrundbild, Hamburger-Schalter. Übergib Akzent und Hintergrund an `setzeLadenDesign`.

**Zwei Dinge, die Plan 1 dafür vorbereitet hat und die du hier zum ersten Mal in Aktion siehst:**

1. Die **Textfarbe wird aus dem Hintergrund abgeleitet.** Ein Laden mit hellem Hintergrund bekommt dunklen Text, auch wenn die dunkle Haut aktiv ist. Das war ein Übergabepunkt aus Plan 1 und ist inzwischen umgesetzt — prüf, dass es hier tatsächlich greift.
2. Die **Textfarbe auf der Akzentfarbe wird berechnet**, statt immer weiß zu sein. Probier es mit einem Laden, der Gelb wählt.

**Hell/Dunkel pro Laden** kommt erst in einem späteren Plan (das Feld `darkMode` gibt es im Backend noch nicht). Bis dahin bleibt es hell.

Ein Logo wird in die Kopfzeile gesetzt, ein Hintergrundbild auf den Seitenhintergrund — beide mit einem Zeitstempel an der Adresse, damit ein ausgetauschtes Bild nicht aus dem Browser-Zwischenspeicher hängenbleibt. Das war eine bereits gelöste Stolperfalle der alten Fassung; übernimm sie.

- [ ] **Step 1: Ablauf verdrahten**

Reihenfolge beim Start:
1. QR-Token lesen, gemerkten `guestToken` nachschlagen.
2. Ist einer da: Status abfragen. Sonst: scannen.
3. **Sofort** Theme und Speisekarte laden und `view-menu` zeigen — auch bei `PENDING`. Bestellen gesperrt.
4. Namensleiste einblenden, Name kann jetzt schon gesetzt werden.
5. Statusabfrage starten. Bei Freigabe: `setzeBestellenErlaubt(true)`, Hinweis entfernen, kurze Meldung über `toast`.
6. Gastgeber: Beitritts-Anfragen mit abfragen und im Banner anzeigen.

- [ ] **Step 2: Alte Datei entfernen**

```bash
cd /c/OrderXpress
grep -rn "js/guest.js" frontend/ --include=*.html --include=*.js | grep -v node_modules
```

Erwartet: kein Treffer außer eventuell in der Vorlade-Liste des Service Workers — die führt `guest.html` bewusst nicht.

```bash
git rm frontend/public/js/guest.js
```

- [ ] **Step 3: Vollständig prüfen**

```bash
cd /c/OrderXpress/frontend && npm test && npx tsc --noEmit && npm run build
cd /c/OrderXpress && mvn clean test
```

- [ ] **Step 4: Commit**

```bash
cd /c/OrderXpress
git add -A
git commit -m "feat: Gaeste-Seite vollstaendig auf das neue System

Erster Verbraucher von theme.ts: Laden-Design wird angewandt, Textfarbe
aus dem Hintergrund abgeleitet. js/guest.js entfaellt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Abnahme dieses Plans

Reine Codeprüfung reicht hier nicht — das hat Plan 1 teuer gelernt. Der blockierende `/assets/**`-Fehler wurde erst sichtbar, als die Anwendung lief.

**Mit laufender App zu prüfen** (`mvn spring-boot:run`, dann im Browser):

1. In der Inhaber-Ansicht einen Tisch anlegen, „Gast-Ansicht" öffnen.
2. **Die Speisekarte muss sofort sichtbar sein**, obwohl der Tisch noch nicht freigegeben ist. Bestellen gesperrt, Hinweis vorhanden.
3. Namen eingeben, während der Tisch noch wartet.
4. In der Inhaber-Ansicht freigeben. Die Gäste-Seite muss **ohne Neuladen** entsperren.
5. Bestellen. In `view-orders` erscheint die Bestellung mit Status „Angenommen".
6. In der Küchen-Ansicht auf „Zubereiten" stellen. Beim Gast muss binnen ~3 Sekunden „In der Küche" stehen.
7. Seite neu laden — der Warenkorb ist wieder da, es ist dieselbe Person.
8. Denselben QR-Code in einem zweiten Browserfenster öffnen: Beitritts-Anfrage erscheint beim Gastgeber.
9. Rechnung teilen: beide Personen sichtbar, Beträge fluchten untereinander.
10. Im Inhaber-Design eine **grelle Akzentfarbe** setzen (Gelb, `#ffff00`). Die Beschriftung der Knöpfe muss **schwarz** werden, nicht weiß. Das ist der Fehler, den Plan 1 behoben hat — hier wird er zum ersten Mal wirklich sichtbar.
11. Einen hellen Laden-Hintergrund setzen und prüfen, dass der Text lesbar bleibt.
12. Auf einem Handy oder im schmalen Fenster: alle Berührungsziele treffbar.

**Ebenfalls Pflicht:** `docker build -t orderxpress-test .` — in Plan 1 übersprungen, wodurch ein kaputter Deploy fast durchgerutscht wäre.
