import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({ api: vi.fn() }));
vi.mock("../../lib/auth", () => ({ authKopfzeilen: vi.fn(() => ({ Authorization: "Basic xyz" })) }));

import { api } from "../../lib/api";
import {
    aendereGericht, aendereKategorie, holeGerichte, holeKategorien,
    legeGerichtAn, legeKategorieAn, loescheGericht, loescheKategorie
} from "./api";

const apiMock = vi.mocked(api);

describe("menu-editor/api", () => {
    it("holt Kategorien ueber GET /api/admin/categories", async () => {
        apiMock.mockResolvedValueOnce([]);
        await holeKategorien();
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories");
    });

    it("holt Gerichte ueber GET /api/admin/menu-items", async () => {
        apiMock.mockResolvedValueOnce([]);
        await holeGerichte();
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items");
    });

    it("legt ein Gericht per POST an, ohne available im Body", async () => {
        apiMock.mockResolvedValueOnce({});
        await legeGerichtAn({ categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, sortOrder: 1 });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items", {
            method: "POST",
            body: JSON.stringify({ categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, sortOrder: 1 })
        });
    });

    it("aendert ein Gericht per PUT mit available im Body", async () => {
        apiMock.mockResolvedValueOnce({});
        await aendereGericht(5, { categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, available: false, sortOrder: 1 });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items/5", {
            method: "PUT",
            body: JSON.stringify({ categoryId: 1, name: "Pizza", description: null, details: null, price: 9.5, available: false, sortOrder: 1 })
        });
    });

    it("loescht ein Gericht per DELETE", async () => {
        apiMock.mockResolvedValueOnce(null);
        await loescheGericht(5);
        expect(apiMock).toHaveBeenCalledWith("/api/admin/menu-items/5", { method: "DELETE" });
    });

    it("legt eine Kategorie per POST an", async () => {
        apiMock.mockResolvedValueOnce({});
        await legeKategorieAn({ name: "Getraenke", sortOrder: 2 });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories", {
            method: "POST",
            body: JSON.stringify({ name: "Getraenke", sortOrder: 2 })
        });
    });

    it("aendert eine Kategorie per PUT", async () => {
        apiMock.mockResolvedValueOnce({});
        await aendereKategorie(2, { name: "Getraenke", sortOrder: 2, active: false });
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories/2", {
            method: "PUT",
            body: JSON.stringify({ name: "Getraenke", sortOrder: 2, active: false })
        });
    });

    it("loescht eine Kategorie per DELETE", async () => {
        apiMock.mockResolvedValueOnce(null);
        await loescheKategorie(2);
        expect(apiMock).toHaveBeenCalledWith("/api/admin/categories/2", { method: "DELETE" });
    });
});
