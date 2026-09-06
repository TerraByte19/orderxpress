import { describe, it, expect } from "vitest";

// Klassisches Skript per Seiteneffekt laden: es setzt window.OX.
import "../../public/js/bildcropper.js";

const crop = (window as any).OX._crop as {
  minSkala(bB: number, bH: number, mB: number, mH: number): number;
  klemmeVersatz(v: number, bildMass: number, skala: number, maskMass: number): number;
  ausgabeMasse(ausgabe: number, ratio: number): { w: number; h: number };
};

describe("bildcropper _crop.minSkala", () => {
  it("wählt die Achse mit dem größeren Bedarf (breites Bild, quadratische Maske)", () => {
    // Bild 400x200, Maske 100x100 -> Höhe bestimmt: 100/200 = 0.5
    expect(crop.minSkala(400, 200, 100, 100)).toBeCloseTo(0.5);
  });
  it("hohes Bild, quadratische Maske -> Breite bestimmt", () => {
    // Bild 200x400, Maske 100x100 -> 100/200 = 0.5
    expect(crop.minSkala(200, 400, 100, 100)).toBeCloseTo(0.5);
  });
  it("breite Maske", () => {
    // Bild 1000x1000, Maske 500x200 -> max(0.5, 0.2) = 0.5
    expect(crop.minSkala(1000, 1000, 500, 200)).toBeCloseTo(0.5);
  });
});

describe("bildcropper _crop.klemmeVersatz", () => {
  it("lässt Versatz im erlaubten Rahmen unverändert", () => {
    // bildMass*skala = 400, maskMass = 100 -> max = (400-100)/2 = 150
    expect(crop.klemmeVersatz(50, 400, 1, 100)).toBe(50);
  });
  it("klemmt zu großen positiven Versatz", () => {
    expect(crop.klemmeVersatz(999, 400, 1, 100)).toBe(150);
  });
  it("klemmt zu großen negativen Versatz", () => {
    expect(crop.klemmeVersatz(-999, 400, 1, 100)).toBe(-150);
  });
  it("bei Bild kleiner/gleich Maske ist der einzige erlaubte Versatz 0", () => {
    expect(crop.klemmeVersatz(20, 100, 1, 100)).toBe(0);
  });
});

describe("bildcropper _crop.ausgabeMasse", () => {
  it("quadratisch bei ratio 1", () => {
    expect(crop.ausgabeMasse(600, 1)).toEqual({ w: 600, h: 600 });
  });
  it("breit bei ratio 2.5", () => {
    expect(crop.ausgabeMasse(1500, 2.5)).toEqual({ w: 1500, h: 600 });
  });
  it("rundet die Höhe", () => {
    expect(crop.ausgabeMasse(1000, 3).h).toBe(333);
  });
});
