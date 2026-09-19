# Struktur-Achsen und Bewegung für die Gäste-Seite

Stand 19.09.2026. Diese Notiz hält fest, **warum** die Änderung so aussieht,
nicht was der Code tut – das steht in den Dateien selbst.

## Ausgangslage

Ein Laden konnte bis hierher Farbe, Hintergrund, Verlauf, hell/dunkel, Radius
(`styleShape`), Schrift (`displayFont`), Warenkorb-Flieger, Bestell-Bestätigung,
Vorhang und Kontaktdaten einstellen. Trotzdem sahen zwei Läden sich ähnlich:

> Die Achsen ändern **Anstrich**. Das **Skelett** blieb bei jedem Laden gleich:
> Hero-Band 160 px → Kategorie-Reiter → Zeilen mit 84-px-Thumbnail → Footer.

Zweites Problem, das daraus folgte: ein Laden ohne Gericht-Fotos bekam überall
den leeren Teller-Platzhalter. Das sah nicht nach Absicht aus, sondern nach
Fehler – und betrifft genau die Läden, für die das System interessant ist
(Bars, Bäckereien, Weinkarten).

## Entscheidung

Sechs neue Achsen, alle nullable, alle so gewählt, dass sie **Aufbau und
Rhythmus** ändern statt einer weiteren Farbe:

| Achse | Werte | Was sie ändert |
|---|---|---|
| `menuLayout` | LISTE \| KACHELN \| TAFEL | Aufbau der Karte |
| `heroStyle` | BAND \| VOLL \| SCHLICHT | Auftakt der Seite |
| `categoryStyle` | REITER \| HAMBURGER \| KAPITEL | Wie man Kategorien findet |
| `textureStyle` | KEIN \| PAPIER \| LINIEN \| TERRAZZO | Material des Untergrunds |
| `controlStyle` | FLACH \| RAHMEN \| ERHOBEN | Optik aller Knöpfe |
| `motionLevel` | DEZENT \| NORMAL \| VERSPIELT | Stärke aller Bewegungen |

TAFEL ist dabei die wichtigste: sie ist die Antwort auf „Laden ohne Fotos".
Keine Bilder, keine Kartenflächen, Punktlinie zwischen Name und Preis,
Haarlinien dazwischen – die gedruckte Speisekarte.

### Warum `categoryStyle` und nicht ein zweiter Schalter

`categoriesAsHamburger` (boolean) existierte schon. Statt daneben einen zweiten
Schalter zu stellen, führt jetzt die dreiwertige Achse, und der alte Schalter
wird beim Speichern mitgezogen (`RestaurantAdminService.updateDesign`).
Rückwärts gilt dasselbe: fehlt die Achse (alter Client, alter Datensatz), wird
sie aus dem Schalter abgeleitet. Ohne diese Ableitung würde ein Speichern aus
einem alten Client die Navigation eines Ladens stillschweigend zurücksetzen.

### Warum die Standardwerte kein data-Attribut setzen

`theme.ts` schreibt nur abweichende Werte auf `<html>`. Sonst müsste jede
Grundregel in `tokens.css`/`components.css` ein zweites Mal als
`:root[data-layout="liste"] …` geschrieben werden. Ein unbekannter Wert (neueres
Backend, älteres Frontend) fällt aus demselben Grund still auf den Standard
zurück, statt ein Attribut zu setzen, für das es keine Regel gibt.

## Bewegung

Der Auftrag lautete „mehr Animation". Die Umsetzung hält sich trotzdem an eine
Regel: **Bewegung antwortet auf eine Handlung, oder sie ist der eine inszenierte
Moment.** Kein Einblenden auf jedem Abschnitt, kein Hover-Effekt auf jeder Karte.

- **Das angetippte Foto wird das grosse Foto.** Der eine grosse Moment. Ein fest
  positionierter Klon wandert von der Karte auf das Foto im Detail-Blatt.
  Animiert werden `left/top/width/height` statt `transform: scale()` – die
  beiden Fotos haben verschiedene Seitenverhältnisse (84 × 84 gegen 4 : 3), eine
  Skalierung würde das Bild sichtbar verziehen. Während das Foto wandert,
  schiebt sich das Blatt **nicht** zusätzlich hoch, sondern blendet auf: zwei
  gleichzeitige Bewegungen auf derselben Fläche lesen sich als Zucken – und nur
  so steht das Ziel beim Messen schon an seinem Platz.
- **Der Kopf setzt sich** (nur `heroStyle: VOLL`, nur beim Öffnen): das Foto
  steht 8 % zu gross und wandert in seine Lage.
- **Die Warenkorb-Summe läuft** auf ihren neuen Wert, statt zu springen. Die
  Leiste federt herein, wenn der erste Artikel im Korb liegt – nicht bei jeder
  Mengenänderung.
- **Fortschritts-Schiene** an jeder Bestellung (angenommen → in der Küche →
  fertig). Der Chip sagt, *wo* die Bestellung steht; die Schiene zeigt, *wie
  weit* – die häufigste Frage am Tisch beantwortet keine Statusbezeichnung.
- **Platzhalter beim Laden** statt leerer Fläche.

`motionLevel` skaliert das alles über drei Variablen (`--ox-dur-fast`,
`--ox-dur`, `--ox-dur-slow`); DEZENT legt zusätzlich `--ox-ease-spring` auf die
ruhige Kurve und nimmt damit jedes Überschwingen heraus, ohne dass eine einzige
Regel davon wissen muss. `prefers-reduced-motion` schlägt weiterhin alles.

## Verworfen

- **Mini-Hero** (Ladenname schrumpft beim Scrollen in die Kopfzeile). Die Frage
  „wo bin ich" beantworten die Kategorie-Reiter bzw. die klebenden
  Kapitel-Überschriften bereits. Ein Effekt weniger.
- **Verlauf im VOLL-Kopf ohne Foto.** Das Problem war nicht die flache Fläche,
  sondern ihre Grösse – über einen halben Bildschirm reines Akzentfeld sieht
  unfertig aus. Gelöst durch 34 statt 62 vh, nicht durch Dekoration.
- **`repeating-linear-gradient` mit Halb-Pixel-Linien für PAPIER.** Wird über
  die volle Höhe des Seitenkörpers berechnet; die Rundungsfehler summieren sich
  zu sichtbaren Keilen. Ersetzt durch eine 4-px-Kachel (`background-size`), die
  sich exakt wiederholt.

## Zwei Fallen, die beim Bauen zugeschnappt sind

1. **`img { max-width: 100% }` aus `base.css`** kappt die berechnete Breite des
   grossen Detail-Fotos (`width: calc(100% + 2 * --ox-space-5)`) wieder auf die
   Textbreite. Das Foto endete vor der rechten Kante. `max-width: none` nötig –
   gilt auch für den fliegenden Klon.
2. **Platzhalter-Karten fallen auf Breite 0 zusammen.** Die echte Karte bekommt
   ihre Breite vom Text im Inhalt-Block; der Platzhalter hat nur Blöcke mit
   Prozentbreiten. Ohne `flex: 1` sind die grauen Zeilen unsichtbar.

## Live-Vorschau im Admin

Sechs Achsen, die man sehen muss, um sie zu wählen. Die Design-Karte bekommt
deshalb rechts die **echte** Gäste-Seite im Vorschau-Modus (`?vorschau=1`, kein
Scan, keine Session, kein Bestellen) als iframe. Jede Änderung geht per
`postMessage` als Entwurf hinein (`ox-vorschau-design`) – gespeichert wird erst
mit dem Knopf. Dieselbe Mechanik nutzte schon der Bild-Zuschnitt; es kam nur
eine zweite Nachrichtenart dazu.

## Datenbank

Sechs nullable Spalten an `restaurants`. **Kein Reset nötig** – geprüft: die
laufende H2-Datei wurde von `ddl-auto: update` ohne Fehler erweitert, und ein
Laden ohne gespeicherte Achsen liefert über die Getter weiterhin genau seine
bisherige Optik.
