/* Bewegungs-Helfer der Gaeste-Seite. Alle respektieren prefers-reduced-motion
 * und degradieren sauber, wo eine Browser-API fehlt (jsdom in den Tests).
 * Vorlage: guest-prototype.html (Brainstorming-Sitzung). */

export function bewegungAus(): boolean {
    try {
        return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
        return false;
    }
}

export type BewegungsStufe = "dezent" | "normal" | "verspielt";

/** Die vom Laden gewaehlte Bewegungsstaerke (Achse motionLevel). theme.ts
 *  schreibt sie als data-motion auf <html>; fehlt das Attribut, gilt normal.
 *  Die CSS-Seite skaliert darueber bereits alle Dauern (laden-stile.css) -
 *  diese Funktion ist fuer die wenigen Bewegungen da, deren Dauer in
 *  JavaScript steht und die deshalb nicht ueber eine Variable mitgehen. */
export function bewegungsStufe(): BewegungsStufe {
    const wert = document.documentElement.dataset.motion;
    return wert === "dezent" || wert === "verspielt" ? wert : "normal";
}

/** Gestaffeltes Einblenden. Haengt .ox-anim-stagger an; sobald ein Element in
 *  den Blick scrollt, .is-in mit `versatzMs`-Staffelung. Ohne IntersectionObserver
 *  oder bei reduzierter Bewegung: sofort alle. */
export function staffelEin(elemente: HTMLElement[], versatzMs = 45): void {
    for (const el of elemente) el.classList.add("ox-anim-stagger");

    if (bewegungAus() || typeof IntersectionObserver === "undefined") {
        for (const el of elemente) el.classList.add("is-in");
        return;
    }

    const beobachter = new IntersectionObserver((eintraege, self) => {
        eintraege.forEach((eintrag, i) => {
            if (!eintrag.isIntersecting) return;
            window.setTimeout(() => eintrag.target.classList.add("is-in"), i * versatzMs);
            self.unobserve(eintrag.target);
        });
    }, { threshold: 0.1 });

    for (const el of elemente) beobachter.observe(el);
}

/** Klon fliegt von `quelle` zu `ziel`. modus PHOTO + bildUrl -> rundes Foto,
 *  sonst "+1". Bei reduzierter Bewegung: nichts. */
export function fliegeZu(
    quelle: HTMLElement,
    ziel: HTMLElement,
    opt: { modus: "PLUS" | "PHOTO"; bildUrl?: string | null }
): void {
    if (bewegungAus()) return;

    const q = quelle.getBoundingClientRect();
    const z = ziel.getBoundingClientRect();
    const flieger = document.createElement("div");
    flieger.className = "ox-flieger";

    let x = q.left, y = q.top, b = q.width, h = q.height;
    if (opt.modus === "PHOTO" && opt.bildUrl) {
        b = h = 56;
        x = q.left + q.width / 2 - 28;
        y = q.top + q.height / 2 - 28;
        flieger.style.borderRadius = "50%";
        const bild = document.createElement("img");
        bild.src = opt.bildUrl;
        bild.alt = "";
        bild.addEventListener("error", () => { flieger.textContent = "+1"; });
        flieger.appendChild(bild);
    } else {
        flieger.textContent = "+1";
    }
    flieger.style.left = `${x}px`;
    flieger.style.top = `${y}px`;
    flieger.style.width = `${b}px`;
    flieger.style.height = `${h}px`;
    document.body.appendChild(flieger);

    requestAnimationFrame(() => {
        const dx = z.left - x + (z.width - b) / 2;
        const dy = z.top - y;
        flieger.style.transform = `translate(${dx}px, ${dy}px) scale(.3)`;
        flieger.style.opacity = "0";
    });
    window.setTimeout(() => flieger.remove(), 480);
}

/* ---------- Das angetippte Foto wird das grosse Foto ---------- */

/** Dauer des Foto-Wechsels je Bewegungsstufe. Muss NICHT zu einer
 *  CSS-Variable passen: der Klon traegt seine Uebergangsdauer selbst. */
const FOTO_DAUER: Record<BewegungsStufe, number> = {
    dezent: 180,
    normal: 320,
    verspielt: 420
};

/** Laesst das Foto der Karte in das grosse Foto des Detail-Blattes wachsen -
 *  der eine grosse Moment der Seite, und er antwortet auf eine Handlung des
 *  Gastes, statt von allein zu laufen.
 *
 *  Verfahren: ein fest positionierter Klon startet exakt auf dem kleinen Foto
 *  und wandert auf Platz und Groesse des grossen. Animiert werden left/top/
 *  width/height statt transform: scale() - die beiden Fotos haben
 *  verschiedene Seitenverhaeltnisse (84x84 gegen 4:3), eine Skalierung wuerde
 *  das Bild sichtbar verziehen. Mit object-fit: cover am Klon (guest.css)
 *  bleibt es dagegen in jeder Zwischengroesse richtig beschnitten. Es ist
 *  EIN fest positioniertes Element, der Layout-Aufwand dafuer ist
 *  vernachlaessigbar.
 *
 *  Das Ziel muss bereits an seiner endgueltigen Stelle stehen - deshalb ruft
 *  menu.ts erst nach is-open, und das Blatt schiebt sich in diesem Fall nicht
 *  hoch, sondern blendet auf (siehe .ox-detail-overlay--foto in guest.css).
 *  Ohne Layout (jsdom in den Tests) sind alle Masse 0 und die Funktion
 *  kehrt wirkungslos zurueck. */
export function wachseFoto(quelle: HTMLElement, ziel: HTMLElement): void {
    if (bewegungAus()) return;

    const q = quelle.getBoundingClientRect();
    const z = ziel.getBoundingClientRect();
    if (!q.width || !q.height || !z.width || !z.height) return;

    const klon = document.createElement("img");
    klon.className = "ox-foto-klon";
    klon.alt = "";
    klon.setAttribute("aria-hidden", "true");
    // Bewusst die Quelle des ZIELS: das ist dasselbe Bild in voller
    // Aufloesung, und es liegt bereits im Cache des Browsers.
    klon.src = (ziel as HTMLImageElement).src;

    const rundungVon = lesRundung(quelle);
    const rundungBis = lesRundung(ziel);
    klon.style.left = `${q.left}px`;
    klon.style.top = `${q.top}px`;
    klon.style.width = `${q.width}px`;
    klon.style.height = `${q.height}px`;
    klon.style.borderRadius = rundungVon;

    const dauer = FOTO_DAUER[bewegungsStufe()];
    klon.style.transition = [
        `left ${dauer}ms var(--ox-ease-out)`,
        `top ${dauer}ms var(--ox-ease-out)`,
        `width ${dauer}ms var(--ox-ease-out)`,
        `height ${dauer}ms var(--ox-ease-out)`,
        `border-radius ${dauer}ms var(--ox-ease-out)`
    ].join(", ");

    document.body.appendChild(klon);
    // Das echte Foto bleibt im Fluss (kein Springen des Blattes), ist aber
    // unsichtbar, bis der Klon darauf gelandet ist.
    ziel.style.visibility = "hidden";

    requestAnimationFrame(() => {
        klon.style.left = `${z.left}px`;
        klon.style.top = `${z.top}px`;
        klon.style.width = `${z.width}px`;
        klon.style.height = `${z.height}px`;
        klon.style.borderRadius = rundungBis;
    });

    window.setTimeout(() => {
        klon.remove();
        ziel.style.visibility = "";
    }, dauer + 40);
}

/** getComputedStyle fehlt in keiner echten Umgebung, in Tests aber schon -
 *  dort genuegt der leere Rueckfall. */
function lesRundung(element: HTMLElement): string {
    try {
        return window.getComputedStyle(element).borderRadius || "0px";
    } catch {
        return "0px";
    }
}

/* ---------- Zahl laeuft auf ihren neuen Wert ---------- */

/** Laesst eine Zahl (Warenkorb-Summe) auf ihren neuen Wert laufen, statt sie
 *  springen zu lassen - die Summe ist die Zahl, auf die der Gast achtet.
 *  `schreibe` bekommt Zwischenwerte und formatiert sie selbst (Preis, Anzahl).
 *
 *  Bei reduzierter Bewegung oder Stufe "dezent" wird nur der Endwert
 *  geschrieben: dort ist Bewegung um der Bewegung willen unerwuenscht. */
export function zaehleHoch(von: number, bis: number, schreibe: (wert: number) => void): void {
    if (von === bis) {
        schreibe(bis);
        return;
    }
    if (bewegungAus() || bewegungsStufe() === "dezent" || typeof requestAnimationFrame === "undefined") {
        schreibe(bis);
        return;
    }

    const dauer = bewegungsStufe() === "verspielt" ? 520 : 380;
    const start = performance.now();
    const schritt = (jetzt: number): void => {
        const anteil = Math.min(1, (jetzt - start) / dauer);
        // Weich auslaufen (ease-out kubisch) - dieselbe Anmutung wie --ox-ease-out.
        const weich = 1 - Math.pow(1 - anteil, 3);
        schreibe(von + (bis - von) * weich);
        if (anteil < 1) requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
}

/** Ansichtswechsel. Frueher mit document.startViewTransition() fuer einen
 *  weichen Uebergang - bewusst entfernt (Fehlerbericht + Nachtest): die
 *  View-Transitions-API macht "position: sticky" nach dem ersten
 *  Ansichtswechsel dauerhaft kaputt (die Kategorien-Leiste blieb dann beim
 *  Scrollen nicht mehr oben stehen). Sticky ist hier wichtiger als der
 *  kurze Ueberblend-Effekt. */
export function mitAnsichtsWechsel(wechsel: () => void): void {
    wechsel();
}
