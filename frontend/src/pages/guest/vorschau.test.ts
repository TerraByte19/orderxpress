import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  istVorschau, vorschauRestaurantId, vorschauFokus,
  verarbeiteVorschauNachricht, meldeVorschauBereit,
  hebeFokusHervor, starteVorschau
} from "./vorschau";

function setSearch(s: string) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, search: s, origin: "http://localhost" },
    writable: true
  });
}

beforeEach(() => {
  document.body.innerHTML =
    '<img id="brand-logo" hidden>' +
    '<div id="menu-hero"></div>' +
    '<img id="hero-logo" hidden>' +
    '<div id="menu-gallery" hidden></div>' +
    '<div class="ox-gericht" data-gericht-id="7"><img class="ox-gericht__bild"></div>' +
    '<div class="ox-gericht" data-gericht-id="9"><div class="ox-gericht__bild ox-gericht__bild--leer"></div></div>';
});

describe("vorschau: Parameter", () => {
  it("erkennt vorschau=1", () => {
    setSearch("?vorschau=1&restaurant=3&fokus=logo");
    expect(istVorschau()).toBe(true);
    expect(vorschauRestaurantId()).toBe(3);
    expect(vorschauFokus()).toBe("logo");
  });
  it("ohne Parameter", () => {
    setSearch("");
    expect(istVorschau()).toBe(false);
    expect(vorschauRestaurantId()).toBe(0);
  });
});

describe("vorschau: Nachrichten-Handler", () => {
  const mk = (data: unknown, origin = "http://localhost") =>
    ({ origin, data } as MessageEvent);

  it("ignoriert fremde Origin", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "logo", dataUrl: "data:x" }, "http://boes"));
    expect((document.getElementById("brand-logo") as HTMLImageElement).getAttribute("src")).toBeNull();
  });
  it("logo -> brand-logo + hero-logo src + sichtbar", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "logo", dataUrl: "data:img" }));
    const b = document.getElementById("brand-logo") as HTMLImageElement;
    const h = document.getElementById("hero-logo") as HTMLImageElement;
    expect(b.src).toContain("data:img");
    expect(b.hidden).toBe(false);
    expect(h.src).toContain("data:img");
  });
  it("background -> menu-hero backgroundImage + Klasse", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "background", dataUrl: "data:bg" }));
    const hero = document.getElementById("menu-hero") as HTMLElement;
    expect(hero.style.backgroundImage).toContain("data:bg");
    expect(hero.classList.contains("ox-hero--bild")).toBe(true);
  });
  it("gericht mit id -> nur dieses Bild, --leer wird ersetzt", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "gericht", gerichtId: "9", dataUrl: "data:foto" }));
    const karte9 = document.querySelector('[data-gericht-id="9"] .ox-gericht__bild') as HTMLImageElement;
    expect(karte9.tagName).toBe("IMG");
    expect(karte9.src).toContain("data:foto");
    const karte7 = document.querySelector('[data-gericht-id="7"] .ox-gericht__bild') as HTMLImageElement;
    expect(karte7.getAttribute("src")).toBeNull();
  });
  it("galerie -> erstes Bild oder eingefügt, Container sichtbar", () => {
    verarbeiteVorschauNachricht(mk({ typ: "ox-vorschau", ziel: "galerie", dataUrl: "data:g" }));
    const g = document.getElementById("menu-gallery") as HTMLElement;
    expect(g.hidden).toBe(false);
    expect((g.querySelector("img") as HTMLImageElement).src).toContain("data:g");
  });
  it("ignoriert fremden typ", () => {
    verarbeiteVorschauNachricht(mk({ typ: "anderes", ziel: "logo", dataUrl: "data:x" }));
    expect((document.getElementById("brand-logo") as HTMLImageElement).getAttribute("src")).toBeNull();
  });
});

describe("vorschau: meldeVorschauBereit", () => {
  it("postet an window.parent mit eigener Origin", () => {
    const spy = vi.fn();
    Object.defineProperty(window, "parent", { value: { postMessage: spy }, writable: true });
    setSearch("");
    meldeVorschauBereit();
    expect(spy).toHaveBeenCalledWith({ typ: "ox-vorschau-bereit" }, window.location.origin);
  });
});

describe("vorschau: hebeFokusHervor", () => {
  it("setzt .ox-vorschau-fokus und nimmt sie nach 1200ms wieder ab (gericht:<id>)", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div class="ox-gericht" data-gericht-id="42"></div>';
    hebeFokusHervor("gericht:42");
    const karte = document.querySelector('[data-gericht-id="42"]') as HTMLElement;
    expect(karte.classList.contains("ox-vorschau-fokus")).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(karte.classList.contains("ox-vorschau-fokus")).toBe(false);
    vi.useRealTimers();
  });
});

describe("vorschau: starteVorschau", () => {
  it("rendert Theme+Menü ohne Scan und sperrt Bestellen", async () => {
    setSearch("?vorschau=1&restaurant=5&fokus=logo");
    document.body.innerHTML =
      '<div id="view-wait"></div><div id="view-menu" hidden></div>' +
      '<div id="menu-hero"></div><img id="brand-logo" hidden><img id="hero-logo" hidden>' +
      '<div id="menu-gallery" hidden></div><div id="cartbar" hidden></div>';

    const spies = {
      ladeTheme: vi.fn().mockResolvedValue({ accentColor: "#1f3d34", categoriesAsHamburger: true }),
      ladeSpeisekarte: vi.fn().mockResolvedValue([]),
      zeigeGalerie: vi.fn().mockResolvedValue(undefined),
      wendeThemeAn: vi.fn(),
      zeichneSpeisekarte: vi.fn(),
      setzeBestellenErlaubt: vi.fn(),
      zeigeAnsichtInhalt: vi.fn()
    };
    await starteVorschau(spies);

    expect(spies.ladeTheme).toHaveBeenCalledWith(5);
    expect(spies.ladeSpeisekarte).toHaveBeenCalledWith(5);
    expect(spies.wendeThemeAn).toHaveBeenCalledWith({ accentColor: "#1f3d34", categoriesAsHamburger: true });
    expect(spies.zeichneSpeisekarte).toHaveBeenCalled();
    // Fix 5: Hamburger-Flag wird aus dem Theme durchgereicht.
    expect(spies.zeichneSpeisekarte).toHaveBeenCalledWith(expect.anything(), true);
    expect(spies.setzeBestellenErlaubt).toHaveBeenCalledWith(false);
    expect(spies.zeigeAnsichtInhalt).toHaveBeenCalledWith("view-menu");
    expect(spies.zeigeGalerie).toHaveBeenCalledWith(5);
    expect(document.documentElement.dataset.vorschau).toBe("1");
  });
});
