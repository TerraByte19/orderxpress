# OrderXpress – manuell über das Frontend testen

Schritt für Schritt durch den ganzen Ablauf:
Laden anlegen → Speisekarte/Tische/Design → Geräte per QR anmelden →
Gäste (Gastgeber + Beitreten) → Küche → Rechnung teilen & Kasse.

---

## 0. Start

```powershell
cd C:\OrderXpress
mvn spring-boot:run
```

Dann im Browser öffnen: `http://localhost:8080`

> Ein Zurücksetzen der Datenbank (`data/` löschen) ist **nur** nötig, wenn sich
> das Schema ändert. Für die Geräte-Funktion nicht.

### Demo-Zugänge

| Rolle | Seite | Benutzer | Passwort |
|---|---|---|---|
| Plattform-Admin | `/platform.html` | `admin` | `admin123` |
| Inhaber | `/admin.html` | `inhaber` | `inhaber123` |
| Service / Kasse | `/service.html` | `service` | `service123` |
| Küche | `/kitchen.html` | `kueche` | `kueche123` |

**Neu:** Als Inhaber meldest du dich nur **einmal** an. Oben erscheint die
Leiste *Inhaber · Service/Kasse · Küche* zum Umschalten — kein zweites Login.
Service und Küche sehen dort jeweils nur ihre eigene Ansicht.

> Für die Gäste-Tests brauchst du zwei Fenster (normal + Inkognito) oder zwei
> Handys — das sind zwei verschiedene *Personen* am Tisch.

---

## 1. Plattform-Admin: Laden anlegen

1. `/platform.html` öffnen, mit `admin` / `admin123` anmelden.
2. „Neuen Laden anlegen" ausfüllen: Name *Test-Pizzeria*, slug *pizza*,
   Inhaber-Benutzer *pizza-chef*, Passwort (mind. 6 Zeichen).
3. Auf „Laden anlegen" — er erscheint in der Liste.

**Soll fehlschlagen:**

- Denselben slug oder Benutzernamen nochmal verwenden → Fehlermeldung.
- Laden „Deaktivieren" → danach wird kein QR-Scan mehr angenommen.

*Zum Weitertesten reicht auch der fertige Demo-Laden mit `inhaber`.*

---

## 2. Inhaber: Umschalt-Leiste prüfen

1. `/admin.html` öffnen, mit `inhaber` / `inhaber123` anmelden.
2. Oben auf „Küche" klicken → du landest im Küchen-Monitor, **ohne neues Login**.
3. Oben auf „Inhaber" zurück.

---

## 3. Inhaber: Speisekarte

1. „+ Kategorie" anlegen, z. B. *Pizza*.
2. „+ Gericht" anlegen: Name, Preis, Kategorie wählen.
3. Bei einem Gericht „Foto" hochladen (JPG oder PNG).
4. Bei einem Gericht „Ausverkauft" schalten.

**Soll fehlschlagen:**

- Kategorie mit gleichem Namen nochmal anlegen → Fehler.
- Kategorie löschen, in der noch Gerichte sind → Fehler.
- Ausverkauftes Gericht taucht in der Gäste-Karte nicht mehr auf.

---

## 4. Inhaber: Tische

1. „+ Tisch hinzufügen" (Nummer wird vorgeschlagen).
2. Bei einem Tisch auf „QR" → QR-Bild zum Ausdrucken.
3. Bei einem Tisch auf „Gast-Ansicht" → öffnet die Gäste-Seite in neuem Tab
   (praktisch zum Testen ohne Handy).

**Soll fehlschlagen:**

- Tischnummer doppelt vergeben → Fehler.
- Tisch auf „inaktiv" setzen, dann QR scannen → „QR-Code ungültig".

---

## 5. Inhaber: Design

1. Akzentfarbe und Hintergrundfarbe wählen.
2. „Hamburger-Menü" ein-/ausschalten.
3. Logo und Hintergrundbild hochladen, dann „Speichern".
4. Gäste-Seite neu laden → Farben, Logo und Hintergrund sind da.
5. Hintergrund „Entfernen", Gäste-Seite neu laden → er ist weg.

---

## 6. Geräte per QR anmelden

Das ersetzt Mitarbeiter-Passwörter auf Tablets.

1. In der Inhaber-Ansicht zur Karte „Geräte (Anmelden per QR-Code)".
2. „+ Gerät": Name *Küchen-Tablet*, Rolle *Küche* → speichern.
   Der QR-Code erscheint sofort.
3. Mit dem Handy oder Tablet scannen → Meldung „Gerät angemeldet", danach
   springt die Seite automatisch in den Küchen-Monitor. Kein Passwort.
4. Zurück in der Inhaber-Ansicht: Das Gerät steht auf „angemeldet" und zeigt
   „zuletzt aktiv …".

**Soll fehlschlagen:**

- Denselben QR-Code ein zweites Mal scannen → „ungültig oder bereits verwendet".
  Ein Code gilt genau einmal.
- „Neu einrichten" → neuer QR-Code, der alte funktioniert nicht mehr.
- „Sperren" → das Gerät fliegt sofort raus und landet wieder im Login.

> Wer das Tablet in der Hand hat, ist angemeldet. Deshalb gibt es Gerätenamen,
> „zuletzt aktiv" und gezieltes Sperren.

---

## 7. Gast: Gastgeber (Fenster 1)

1. Inhaber-Ansicht → bei einem Tisch auf „Gast-Ansicht" (oder QR scannen).
   Es erscheint „Einen Moment bitte …".
2. In die Inhaber- oder Service-Ansicht wechseln: unter „Freigabe-Anfragen"
   steht *„Tisch Nr. X freigeben?"* → auf „Freigeben".
3. Zurück im Gast-Fenster: Die Speisekarte erscheint, oben steht „Du bist: Gast 1".
4. Auf „Namen ändern" und z. B. *Adham* eintragen.

---

## 8. Gast: Beitreten (Fenster 2, Inkognito)

1. Dieselbe Gast-URL öffnen. Es erscheint „Bitte warte kurz – jemand am Tisch
   lässt dich gleich rein."
2. In **Fenster 1** erscheint oben: *„Gast 2 möchte an deinen Tisch. Reinlassen?"*
3. Auf „Ja, reinlassen" → Fenster 2 sieht jetzt die Speisekarte.

**Soll fehlschlagen:**

- Fenster 2 versucht **vor** der Freigabe zu bestellen → wird abgelehnt.
- Stattdessen „Ablehnen" → Fenster 2 bekommt „Nicht freigegeben".

**Soll klappen:**

- Gäste-Seite neu laden → man bleibt dieselbe Person, keine neue Anfrage.

---

## 9. Bestellen und Küche

1. Beide Personen legen Gerichte in den Warenkorb
   (Zeile antippen für Details, „+" für schnelles Hinzufügen).
2. Beide auf „Jetzt bestellen".
3. Küchen-Monitor öffnen (`/kitchen.html` oder das QR-Tablet aus Schritt 6):
   Die Bestellungen erscheinen live.
4. Status durchschalten: *Neu → In Zubereitung → Fertig → Serviert*.
5. „Storno" und „Nachdruck" ausprobieren.
6. Im Gast-Fenster unter „Deine bisherigen Bestellungen" ändert sich der Status mit.

---

## 10. Rechnung teilen (Gast)

1. Im Gast-Fenster oben auf „Rechnung teilen".
2. Du siehst **alle Personen** am Tisch mit ihren Positionen.
3. Positionen antippen → unten läuft die Summe der Auswahl mit.

> Gäste rechnen hier nur. Kassiert wird am Personal-Gerät.

---

## 11. Kasse (Personal)

1. `/service.html` öffnen (oder oben in der Leiste auf „Service/Kasse").
2. Beim belegten Tisch auf „Kasse".
3. Positionen anklicken — oder „Alles offene".
4. Die Summe erscheint unten → auf „Als bezahlt markieren".

**Soll klappen:**

- Bezahlte Positionen sind grün markiert, „offen gesamt" sinkt.
- Ein zweiter Kassiervorgang für den Rest funktioniert (Split-Zahlung).

---

## 12. Vom Handy testen (gleiches WLAN)

1. PC-IP herausfinden: PowerShell → `ipconfig` → „IPv4-Adresse",
   z. B. `192.168.1.50`.
2. Am PC die Inhaber-Ansicht über diese IP öffnen:
   `http://192.168.1.50:8080/admin.html`
3. Jetzt enthalten **beide** QR-Arten (Tische und Geräte) automatisch diese
   Adresse statt `localhost`.
4. Am Handy im selben WLAN den QR scannen.

> Lädt nichts? Einmalig die Windows-Firewall für Port 8080 erlauben.

---

## 13. Schnelle Fehler-Checks

Alle folgenden Fälle **sollen** abgelehnt werden:

- Ungültige QR-Adresse aufrufen (`/t/xxxx`) → „QR-Code ungültig".
- Als Küche `/service.html` öffnen → kein Zugang (falsche Rolle).
- Als Inhaber `/platform.html` öffnen → kein Zugang.
- Inaktiven Tisch scannen → ungültig.
- Geräte-QR ein zweites Mal scannen → abgelehnt.

---

## 14. Automatische Tests

```powershell
mvn clean test
```

Rund 95 Tests prüfen: Plattform und Läden, Mandanten-Trennung, Speisekarte,
Tische, Rollen und Logins, Geräte-Anmeldung, Design und Bilder, Gast-Beitritt,
Rechnung und Kasse, Küchen-Statuswechsel sowie die Zugriffsrechte.
