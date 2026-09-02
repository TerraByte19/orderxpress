import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminGericht } from "../../lib/types";

vi.mock("./api", () => ({
    aendereGericht: vi.fn(),
    legeGerichtAn: vi.fn(),
    ladeGerichtFoto: vi.fn(),
    loescheGerichtFoto: vi.fn()
}));

import { aendereGericht, ladeGerichtFoto, legeGerichtAn, loescheGerichtFoto } from "./api";
import { oeffneGerichtBearbeiten, oeffneGerichtNeu } from "./sheet";

const aendereMock = vi.mocked(aendereGericht);
const legeAnMock = vi.mocked(legeGerichtAn);
const ladeFotoMock = vi.mocked(ladeGerichtFoto);
const loescheFotoMock = vi.mocked(loescheGerichtFoto);

function gericht(ueberschreibungen: Partial<AdminGericht> = {}): AdminGericht {
    return {
        id: 5, categoryId: 1, categoryName: "Pizza", name: "Margherita",
        description: "Tomate", details: null, price: 9.5, available: true,
        sortOrder: 1, imageUrl: null, ...ueberschreibungen
    };
}

const naechsterFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

beforeEach(() => { document.body.innerHTML = ""; vi.clearAllMocks(); });
afterEach(() => { document.body.innerHTML = ""; });

describe("oeffneGerichtBearbeiten", () => {
    it("befuellt die Felder mit dem bestehenden Gericht", async () => {
        oeffneGerichtBearbeiten(gericht(), () => {});
        await naechsterFrame();
        const name = document.querySelector<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        expect(name?.value).toBe("Margherita");
    });

    it("speichert per aendereGericht und ruft beiGespeichert", async () => {
        aendereMock.mockResolvedValueOnce(gericht({ name: "Diavola" }));
        const beiGespeichert = vi.fn();
        oeffneGerichtBearbeiten(gericht(), beiGespeichert);
        await naechsterFrame();

        const felder = document.querySelectorAll<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        felder[0].value = "Diavola";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(aendereMock).toHaveBeenCalledWith(5, expect.objectContaining({ name: "Diavola", categoryId: 1 }));
        expect(beiGespeichert).toHaveBeenCalled();
    });

    it("blockt das Speichern bei leerem Namen", async () => {
        oeffneGerichtBearbeiten(gericht(), () => {});
        await naechsterFrame();
        const felder = document.querySelectorAll<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        felder[0].value = "";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
        expect(aendereMock).not.toHaveBeenCalled();
    });
});

describe("Foto-Upload/-Loeschen im Bearbeiten-Sheet", () => {
    function waehleDatei(datei: File): void {
        const dateiFeld = document.querySelector<HTMLInputElement>(".ox-editor-overlay input[type=file]")!;
        Object.defineProperty(dateiFeld, "files", { value: [datei], configurable: true });
        dateiFeld.dispatchEvent(new Event("change"));
    }

    it("ruft bei erfolgreichem Foto-Upload beiGespeichert auf", async () => {
        ladeFotoMock.mockResolvedValueOnce(undefined);
        const beiGespeichert = vi.fn();
        oeffneGerichtBearbeiten(gericht(), beiGespeichert);
        await naechsterFrame();

        waehleDatei(new File(["x"], "foto.jpg", { type: "image/jpeg" }));
        await Promise.resolve(); await Promise.resolve();

        expect(ladeFotoMock).toHaveBeenCalledWith(5, expect.any(File));
        expect(beiGespeichert).toHaveBeenCalled();
    });

    it("zeigt einen Fehler bei fehlgeschlagenem Foto-Upload und ruft beiGespeichert NICHT auf", async () => {
        ladeFotoMock.mockRejectedValueOnce(new Error("Foto konnte nicht hochgeladen werden"));
        const beiGespeichert = vi.fn();
        oeffneGerichtBearbeiten(gericht(), beiGespeichert);
        await naechsterFrame();

        waehleDatei(new File(["x"], "foto.jpg", { type: "image/jpeg" }));
        await Promise.resolve(); await Promise.resolve();

        const fehlerAnzeige = document.querySelector(".ox-editor-overlay .ox-muted");
        expect(fehlerAnzeige?.textContent).toBe("Foto konnte nicht hochgeladen werden");
        expect(beiGespeichert).not.toHaveBeenCalled();
    });

    it("ruft bei erfolgreichem Foto-Loeschen beiGespeichert auf", async () => {
        loescheFotoMock.mockResolvedValueOnce(undefined);
        const beiGespeichert = vi.fn();
        oeffneGerichtBearbeiten(gericht({ imageUrl: "/api/admin/menu-items/5/image" }), beiGespeichert);
        await naechsterFrame();

        const loeschen = [...document.querySelectorAll("button")].find((b) => b.textContent === "Foto löschen")!;
        loeschen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(loescheFotoMock).toHaveBeenCalledWith(5);
        expect(beiGespeichert).toHaveBeenCalled();
    });

    it("zeigt einen Fehler bei fehlgeschlagenem Foto-Loeschen und ruft beiGespeichert NICHT auf", async () => {
        loescheFotoMock.mockRejectedValueOnce(new Error("Loeschen fehlgeschlagen"));
        const beiGespeichert = vi.fn();
        oeffneGerichtBearbeiten(gericht({ imageUrl: "/api/admin/menu-items/5/image" }), beiGespeichert);
        await naechsterFrame();

        const loeschen = [...document.querySelectorAll("button")].find((b) => b.textContent === "Foto löschen")!;
        loeschen.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        const fehlerAnzeige = document.querySelector(".ox-editor-overlay .ox-muted");
        expect(fehlerAnzeige?.textContent).toBe("Loeschen fehlgeschlagen");
        expect(beiGespeichert).not.toHaveBeenCalled();
    });
});

describe("oeffneGerichtNeu", () => {
    it("legt per legeGerichtAn mit der uebergebenen Kategorie/Position an", async () => {
        legeAnMock.mockResolvedValueOnce(gericht({ id: 9 }));
        const beiGespeichert = vi.fn();
        oeffneGerichtNeu(3, 2, beiGespeichert);
        await naechsterFrame();

        const felder = document.querySelectorAll<HTMLInputElement>(".ox-editor-overlay input[type=text]");
        felder[0].value = "Calzone";
        felder[1].value = "8,00";
        const speichern = [...document.querySelectorAll("button")].find((b) => b.textContent === "Speichern")!;
        speichern.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve(); await Promise.resolve();

        expect(legeAnMock).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 3, sortOrder: 2, name: "Calzone", price: 8 }));
        expect(beiGespeichert).toHaveBeenCalled();
    });
});
