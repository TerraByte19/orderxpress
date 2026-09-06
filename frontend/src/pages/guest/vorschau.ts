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

export function verarbeiteVorschauNachricht(e: MessageEvent): void {
  if (e.origin !== window.location.origin) return;
  const d = e.data as VorschauNachricht | null;
  if (!d || d.typ !== "ox-vorschau" || !d.dataUrl) return;

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
    const slot = document.querySelector(
      `[data-gericht-id="${CSS.escape(d.gerichtId)}"] .ox-gericht__bild`
    );
    if (!slot) return;
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
  elm.scrollIntoView({ block: "center", behavior: "smooth" });
  elm.classList.add("ox-vorschau-fokus");
  setTimeout(() => elm.classList.remove("ox-vorschau-fokus"), 1200);
}
