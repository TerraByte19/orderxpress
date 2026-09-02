import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminKategorie } from "../../lib/types";

vi.mock("./api", () => ({ aendereKategorie: vi.fn(), legeKategorieAn: vi.fn() }));

import { aendereKategorie, legeKategorieAn } from "./api";
import { oeffneKategorieBearbeiten, oeffneKategorieNeu } from "./kategorie-sheet";

const aendereMock = vi.mocked(aendereKategorie);
const legeAnMock = vi.mocked(legeKategorieAn);

function kategorie(ueberschreibungen: Partial<AdminKategorie> = {}): AdminKategorie {
    return { id: 2, name: "Getraenke", sortOrder: 2, active: true, ...ueberschreibungen };
}

const naechsterFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

beforeEach(() => { document.body.innerHTML = ""; vi.clearAllMocks(); });
afterEach(() => { document.body.innerHTML = ""; });

describe("oeffneKategorieBearbeiten", () => {
    it("speichert Name und Sichtbarkeit per aendereKategorie", async () => {
        aendereMock.mockResolvedValueOnce(kategorie({ active: false }));
        const beiGespeichert = vi.fn();
        oeffneKategorieBearbeiten(kategorie(), beiGespeichert);
        await naechsterFrame();

        const name = document.querySelector<HTMLInputElement>(".ox-kategorie-overlay input[type=text]")!;
        name.value = "Getränke & Softdrinks";
        const sichtbar = document.querySelector<HTMLInputElement>(".ox-kategorie-overlay input[type=checkbox]")!;
        sichtbar.checked = false;
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(aendereMock).toHaveBeenCalledWith(2, { name: "Getränke & Softdrinks", active: false, sortOrder: 2 });
        expect(beiGespeichert).toHaveBeenCalled();
    });
});

describe("oeffneKategorieNeu", () => {
    it("legt mit der uebergebenen Position an", async () => {
        legeAnMock.mockResolvedValueOnce(kategorie({ id: 9 }));
        const beiGespeichert = vi.fn();
        oeffneKategorieNeu(4, beiGespeichert);
        await naechsterFrame();

        const name = document.querySelector<HTMLInputElement>(".ox-kategorie-overlay input[type=text]")!;
        name.value = "Desserts";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(legeAnMock).toHaveBeenCalledWith({ name: "Desserts", sortOrder: 4 });
        expect(beiGespeichert).toHaveBeenCalled();
    });
});
