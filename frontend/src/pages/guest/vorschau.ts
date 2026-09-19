// frontend/src/pages/guest/vorschau.ts
/* Vorschau-Modus der Gaeste-Seite: wird vom Inhaber-Zuschnitt-Widget als iframe
 * geladen (?vorschau=1&restaurant=<id>&fokus=<ziel>). Kein Scan, keine Session,
 * kein Bestellen - nur ansehen. Der Nachrichten-Handler tauscht Logo /
 * Hintergrund / Gericht-Foto / Galerie gegen eine per postMessage uebergebene
 * dataURL, damit der Inhaber live sieht, wie sein Bild beim Gast aussieht. */

function params(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function istVorschau(): boolean {
  return params().get("vorschau") === "1";
}

export function vorschauRestaurantId(): number {
  const n = Number(params().get("restaurant"));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function vorschauFokus(): string {
  return params().get("fokus") || "";
}

interface VorschauNachricht {
  typ: string;
  ziel: string;
  dataUrl: string;
  gerichtId?: string;
}

/* Zustand der laufenden Vorschau. Wird von starteVorschau() gefuellt und
 * NUR von der Design-Nachricht unten gebraucht: der Inhaber schiebt seine
 * noch nicht gespeicherten Design-Werte herein, und die Seite zeichnet sich
 * damit neu. Ohne diesen Zustand muesste das Fenster fuer jede Aenderung neu
 * geladen werden - dann waere es keine Live-Vorschau. */
let laufendeDeps: VorschauAbhaengigkeiten | null = null;
let laufendesTheme: Record<string, unknown> = {};
let laufendeGerichte: unknown = [];

/** Design-Werte aus der Design-Karte des Inhabers uebernehmen, OHNE zu
 *  speichern. Die Werte werden ueber das geladene Theme gelegt (Name, Logo
 *  und Fotos bleiben also erhalten) und die Karte wird neu gezeichnet -
 *  Aufbau und Kategorien-Navigation koennen sich mitgeaendert haben. */
export function verarbeiteVorschauDesign(design: Record<string, unknown>): void {
  if (!laufendeDeps) return;
  laufendesTheme = { ...laufendesTheme, ...design };
  laufendeDeps.wendeThemeAn(laufendesTheme);
  laufendeDeps.zeichneSpeisekarte(laufendeGerichte, Boolean(laufendesTheme.categoriesAsHamburger));
  laufendeDeps.setzeBestellenErlaubt(false);
}

/** Spielt den Vorhang mit dem AKTUELLEN (noch nicht gespeicherten) Stand.
 *  introRepeat wird dabei bewusst ueberschrieben: "einmal pro Geraet" ist
 *  eine Regel fuer den Gast - ein Vorschau-Knopf, der beim zweiten Druck
 *  nichts mehr tut, waere schlicht kaputt. */
export function spieleVorhangVor(): void {
  if (!laufendeDeps?.zeigeVorhang) return;
  laufendeDeps.zeigeVorhang({ ...laufendesTheme, introRepeat: "IMMER" });
}

export function verarbeiteVorschauNachricht(e: MessageEvent): void {
  if (e.origin !== window.location.origin) return;
  const d = e.data as VorschauNachricht | null;
  if (!d) return;

  // Design-Nachricht (Regler in der Design-Karte) - kein dataUrl noetig.
  if (d.typ === "ox-vorschau-design") {
    const design = (e.data as { design?: Record<string, unknown> }).design;
    if (design) verarbeiteVorschauDesign(design);
    return;
  }

  // Vorhang auf Zuruf abspielen. Ohne das stellt der Inhaber Stil, Tempo,
  // Farbe, Logo und Text ein, ohne das Ergebnis je zu sehen - der Vorhang
  // laeuft sonst nur beim echten Gast, also erst nach Speichern und Scannen.
  if (d.typ === "ox-vorschau-vorhang") {
    spieleVorhangVor();
    return;
  }

  if (d.typ !== "ox-vorschau" || !d.dataUrl) return;

  if (d.ziel === "logo") {
    for (const id of ["brand-logo", "hero-logo"]) {
      const img = document.getElementById(id) as HTMLImageElement | null;
      if (img) { img.src = d.dataUrl; img.hidden = false; }
    }
    return;
  }
  if (d.ziel === "background") {
    const hero = document.getElementById("menu-hero");
    if (hero) {
      hero.style.backgroundImage = `url("${d.dataUrl}")`;
      hero.classList.add("ox-hero--bild");
    }
    return;
  }
  if (d.ziel === "gericht" && d.gerichtId) {
    const karte = document.querySelector(`[data-gericht-id="${CSS.escape(d.gerichtId)}"]`);
    if (!karte) return;
    const slot = karte.querySelector(".ox-gericht__bild");
    if (!slot) {
      // Kachel- und Tafel-Aufbau bauen fuer ein Gericht OHNE Foto gar kein
      // Bildelement (siehe menu.ts). Genau dann laedt der Inhaber aber
      // gerade sein erstes Foto hoch - also eins anlegen, statt die
      // Vorschau stumm ausfallen zu lassen.
      const neuesBild = document.createElement("img");
      neuesBild.className = "ox-gericht__bild";
      neuesBild.alt = "";
      neuesBild.src = d.dataUrl;
      karte.querySelector(".ox-gericht__oeffnen")?.prepend(neuesBild);
      return;
    }
    if (slot.tagName === "IMG") {
      (slot as HTMLImageElement).src = d.dataUrl;
    } else {
      const img = document.createElement("img");
      img.className = "ox-gericht__bild";
      img.alt = "";
      img.src = d.dataUrl;
      slot.replaceWith(img);
    }
    return;
  }
  if (d.ziel === "galerie") {
    const g = document.getElementById("menu-gallery");
    if (!g) return;
    g.hidden = false;
    let img = g.querySelector("img");
    if (!img) { img = document.createElement("img"); g.appendChild(img); }
    img.src = d.dataUrl;
  }
}

export function meldeVorschauBereit(): void {
  try {
    window.parent.postMessage({ typ: "ox-vorschau-bereit" }, window.location.origin);
  } catch { /* ignore */ }
}

export function hebeFokusHervor(fokus: string): void {
  let sel = "";
  if (fokus === "logo") sel = "#brand-logo";
  else if (fokus === "background") sel = "#menu-hero";
  else if (fokus === "galerie") sel = "#menu-gallery";
  else if (fokus.indexOf("gericht:") === 0) sel = `[data-gericht-id="${CSS.escape(fokus.slice(8))}"]`;
  if (!sel) return;
  const elm = document.querySelector(sel) as HTMLElement | null;
  if (!elm) return;
  // Optionaler Aufruf wie in menu.ts: jsdom (Testumgebung) kennt scrollIntoView nicht.
  elm.scrollIntoView?.({ block: "center", behavior: "smooth" });
  elm.classList.add("ox-vorschau-fokus");
  setTimeout(() => elm.classList.remove("ox-vorschau-fokus"), 1200);
}

/* ---------- Vorschau starten -------------------------------------------------
   index.ts' start() biegt hierher ab, wenn istVorschau() greift: KEIN Scan,
   KEINE Session, KEIN Live-Takt, KEIN Vorhang - nur Theme + Speisekarte laden
   und ansehen. Die noetigen Bausteine werden hereingereicht (deps), damit
   dieses Modul nicht den halben Seiten-Aufbau importieren muss und der Ablauf
   testbar bleibt. */

export interface VorschauAbhaengigkeiten {
  ladeTheme: (id: number) => Promise<unknown>;
  ladeSpeisekarte: (id: number) => Promise<unknown>;
  zeigeGalerie: (id: number) => Promise<void>;
  wendeThemeAn: (theme: unknown) => void;
  zeichneSpeisekarte: (gerichte: unknown, hamburger: boolean) => void;
  setzeBestellenErlaubt: (erlaubt: boolean) => void;
  zeigeAnsichtInhalt: (id: string, name?: string) => void;
  /** Optional - nur fuer den Vorhang-Knopf der Design-Karte. */
  zeigeVorhang?: (theme: Record<string, unknown>) => void;
}

export async function starteVorschau(deps: VorschauAbhaengigkeiten): Promise<void> {
  document.documentElement.dataset.vorschau = "1";
  laufendeDeps = deps;
  const id = vorschauRestaurantId();

  // Bild-Austausch vom Inhaber-Widget entgegennehmen (Logo/Hintergrund/Foto/Galerie).
  window.addEventListener("message", verarbeiteVorschauNachricht);

  // Theme ist optional (Rueckfall = Standard-Optik), Speisekarte laeuft
  // parallel - ein Fehlschlag des einen reisst den anderen nicht mit.
  const [theme, gerichte] = await Promise.all([
    deps.ladeTheme(id).catch(() => null),
    deps.ladeSpeisekarte(id).catch(() => [] as unknown)
  ]);
  if (theme) {
    laufendesTheme = theme as Record<string, unknown>;
    deps.wendeThemeAn(theme);
  }
  laufendeGerichte = gerichte ?? [];
  // Kategorien-Sprungnav als Hamburger genau wie im Normalfluss (index.ts):
  // aus dem geladenen Theme lesen, Rueckfall false wenn Theme fehlt.
  const hamburger = !!(theme && (theme as { categoriesAsHamburger?: boolean }).categoriesAsHamburger);
  deps.zeichneSpeisekarte(gerichte ?? [], hamburger);
  deps.setzeBestellenErlaubt(false);
  deps.zeigeAnsichtInhalt("view-menu");
  void deps.zeigeGalerie(id).catch(() => undefined);

  meldeVorschauBereit();
  hebeFokusHervor(vorschauFokus());
}
