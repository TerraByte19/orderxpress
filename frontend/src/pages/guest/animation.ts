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

/** Ansichtswechsel. Frueher mit document.startViewTransition() fuer einen
 *  weichen Uebergang - bewusst entfernt (Fehlerbericht + Nachtest): die
 *  View-Transitions-API macht "position: sticky" nach dem ersten
 *  Ansichtswechsel dauerhaft kaputt (die Kategorien-Leiste blieb dann beim
 *  Scrollen nicht mehr oben stehen). Sticky ist hier wichtiger als der
 *  kurze Ueberblend-Effekt. */
export function mitAnsichtsWechsel(wechsel: () => void): void {
    wechsel();
}
