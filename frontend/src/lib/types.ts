/* Gegenstelle zu den Java-Records unter web/dto.
   Ändert sich dort ein Feld, muss es hier nachgezogen werden. */

export type Rolle = "OWNER" | "SERVICE" | "KITCHEN" | "WAITER";
export type SitzungsStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CLOSED";
export type GastStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BestellStatus = "NEW" | "IN_PREPARATION" | "READY" | "SERVED" | "CANCELLED";

/** MeResponse */
export interface Me {
    name: string;
    role: Rolle;
    restaurantId: number;
    restaurantName: string;
    kitchenDisplayEnabled: boolean;
}

/** ScanResponse */
export interface ScanAntwort {
    guestToken: string;
    isHost: boolean;
    sessionStatus: SitzungsStatus;
    guestStatus: GastStatus;
    guestName: string;
    tableNumber: number;
    restaurantId: number;
    restaurantName: string;
}

/** GuestStatusResponse - Achtung: das Feld heißt "name", nicht "guestName"
    (anders als in ScanResponse). */
export interface GastStatusAntwort {
    guestStatus: GastStatus;
    sessionStatus: SitzungsStatus;
    isHost: boolean;
    name: string;
    tableNumber: number;
    restaurantId: number;
    restaurantName: string;
}

/** RestaurantThemeDto */
export interface LadenTheme {
    id: number;
    name: string;
    accentColor: string;
    backgroundColor: string;
    categoriesAsHamburger: boolean;
    kitchenDisplayEnabled: boolean;
    logoUrl: string | null;
    backgroundUrl: string | null;
    styleShape: string;
    displayFont: string;
    cartFlyStyle: string;
    orderConfirmStyle: string;
    darkMode: boolean;
    introStyle: string;
    introText: string | null;
    introSpeed: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    backgroundColor2: string | null;
    openingHours: string | null;
    address: string | null;
    phone: string | null;
}

/** OrderResponse.OrderLineDto */
export interface BestellZeile {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    note: string | null;
}

/** OrderResponse */
export interface Bestellung {
    id: number;
    tableNumber: number;
    status: BestellStatus;
    createdAt: string;
    totalAmount: number;
    printed: boolean;
    items: BestellZeile[];
}

/** DeviceActivationResponse */
export interface GeraetAktivierung {
    deviceToken: string;
    role: Rolle;
    label: string;
    restaurantId: number;
    restaurantName: string;
}

/** ProblemDetail aus dem GlobalExceptionHandler */
export interface ProblemDetail {
    title?: string;
    detail?: string;
    status?: number;
}

/** MenuItemBadge (Java-Enum) - deutsche Beschriftung + Reihenfolge fuer
 *  Admin-Formular und Gast-Anzeige an einer Stelle. */
export const GERICHT_MARKEN: Array<{ wert: string; label: string }> = [
    { wert: "SCHARF", label: "Scharf" },
    { wert: "VEGETARISCH", label: "Vegetarisch" },
    { wert: "VEGAN", label: "Vegan" },
    { wert: "BELIEBT", label: "Beliebt" },
    { wert: "NEU", label: "Neu" }
];

/** MenuItemDto */
export interface Gericht {
    id: number;
    name: string;
    description: string | null;
    details: string | null;
    price: number;
    imageUrl: string | null;
    badges: string[];
}

/** MenuCategoryDto */
export interface Kategorie {
    id: number;
    name: string;
    items: Gericht[];
}

/** BillDto.Line */
export interface RechnungsZeile {
    orderItemId: number;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    note: string | null;
    paid: boolean;
}

/** BillDto.Participant */
export interface RechnungsPerson {
    guestId: number;
    name: string;
    isHost: boolean;
    items: RechnungsZeile[];
    total: number;
    paidTotal: number;
    openTotal: number;
}

/** BillDto */
export interface Rechnung {
    tableNumber: number;
    sessionId: number;
    participants: RechnungsPerson[];
    grandTotal: number;
    paidTotal: number;
    openTotal: number;
}

/** JoinRequestDto - Rueckgabe von GET /guests/{token}/join-requests.
    Nur der Gastgeber sieht diese Liste (offene Beitritts-Anfragen). */
export interface BeitrittsAnfrage {
    id: number;
    name: string;
    createdAt: string;
}

/** CategoryDto (Admin-Sicht) */
export interface AdminKategorie {
    id: number;
    name: string;
    sortOrder: number;
    active: boolean;
}

/** MenuItemAdminDto */
export interface AdminGericht {
    id: number;
    categoryId: number;
    categoryName: string;
    name: string;
    description: string | null;
    details: string | null;
    price: number;
    available: boolean;
    sortOrder: number;
    imageUrl: string | null;
    badges: string[];
}

/** Optionen fuer den klassischen Bild-Zuschnitt-Dialog aus
 *  public/js/bildcropper.js (setzt window.OX.oeffneCropper). */
export interface CropperOptionen {
    datei: File;
    form: "kreis" | "quadrat" | "breit";
    ratio?: number;
    ausgabe: number;
    fokus: string;
    restaurantId: number | string;
    onFertig: (blob: Blob) => void;
    onAbbrechen?: () => void;
}

declare global {
    interface Window {
        OX?: { oeffneCropper(opts: CropperOptionen): void };
    }
}
