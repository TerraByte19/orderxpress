/* OrderXpress - gemeinsame Helfer fuer alle Seiten */
const OX = {

    euro: new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }),

    /* ---------- Kellner-Ruf: Alarm-Schicht fuer Service/Kellner ----------
       Damit ein Ruf nicht uebersehen wird: Dauer-Banner ganz oben (je Ruf eine
       Zeile mit "Erledigt") + kurzer roter Bildschirm-Blitz bei jedem NEUEN Ruf.
       Klingelton ist standardmaessig AUS - im Banner an-/abschaltbar, Zustand
       gemerkt. update(calls, onDone) wird aus loadCalls() gefuettert (auch mit
       leerer Liste, damit das Banner verschwindet); onDone(id) haakt einen Ruf
       ab (Seite reicht ihre callDone-Funktion durch). flash() zusaetzlich
       sofort aus dem SSE-Handler (waiter-called). */
    callAlert: {
        _bekannt: new Set(),
        _interval: null,
        _actx: null,
        _letzte: [],
        _onDone: null,

        tonAn() {
            try { return localStorage.getItem("ox-ruf-ton") === "1"; } catch (e) { return false; }
        },
        setTonAn(an) {
            try { localStorage.setItem("ox-ruf-ton", an ? "1" : "0"); } catch (e) { /* ignore */ }
            this._render(this._letzte);
        },

        update(calls, onDone) {
            this._letzte = calls || [];
            if (onDone) this._onDone = onDone;
            for (const c of this._letzte) {
                if (!this._bekannt.has(c.id)) { this._bekannt.add(c.id); this.flash(); }
            }
            const ids = new Set(this._letzte.map(function (c) { return c.id; }));
            for (const id of Array.from(this._bekannt)) {
                if (!ids.has(id)) this._bekannt.delete(id);
            }
            this._render(this._letzte);
        },

        flash() {
            let f = document.getElementById("ox-ruf-blitz");
            if (!f) {
                f = document.createElement("div");
                f.id = "ox-ruf-blitz";
                document.body.appendChild(f);
            }
            f.classList.remove("an");
            void f.offsetWidth;
            f.classList.add("an");
        },

        _render(calls) {
            let bar = document.getElementById("ox-ruf-bar");
            if (!calls.length) {
                if (bar) bar.remove();
                this._tonStop();
                return;
            }
            if (!bar) {
                bar = document.createElement("div");
                bar.id = "ox-ruf-bar";
                document.body.appendChild(bar);
            }
            const self = this;
            bar.innerHTML = "";

            const kopf = document.createElement("div");
            kopf.className = "ox-ruf-bar__kopf";
            kopf.innerHTML = "<span>&#128276; " + calls.length +
                (calls.length === 1 ? " Ruf" : " Rufe") + "</span>";
            const tonBtn = document.createElement("button");
            tonBtn.type = "button";
            tonBtn.className = "ox-ruf-bar__ton";
            tonBtn.textContent = this.tonAn() ? "Ton aus" : "Ton an";
            tonBtn.onclick = function () { self.setTonAn(!self.tonAn()); };
            kopf.appendChild(tonBtn);
            bar.appendChild(kopf);

            for (const c of calls) {
                const zeile = document.createElement("div");
                zeile.className = "ox-ruf-bar__zeile";
                const txt = document.createElement("span");
                txt.textContent = "Tisch " + c.tableNumber +
                    (c.guestName ? " · " + c.guestName : "") +
                    " · " + OX.zeit(c.createdAt);
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "ox-ruf-bar__ok";
                btn.textContent = "Erledigt";
                btn.onclick = function () {
                    btn.disabled = true;
                    if (self._onDone) Promise.resolve(self._onDone(c.id)).catch(function () { btn.disabled = false; });
                };
                zeile.appendChild(txt);
                zeile.appendChild(btn);
                bar.appendChild(zeile);
            }

            if (this.tonAn()) this._tonStart(); else this._tonStop();
        },

        _tonStart() {
            if (this._interval) return;
            this._piep();
            const self = this;
            this._interval = setInterval(function () { self._piep(); }, 4000);
        },
        _tonStop() {
            if (this._interval) { clearInterval(this._interval); this._interval = null; }
        },
        _piep() {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return;
                this._actx = this._actx || new Ctx();
                if (this._actx.state === "suspended") this._actx.resume();
                const o = this._actx.createOscillator();
                const g = this._actx.createGain();
                o.type = "sine";
                o.frequency.value = 880;
                o.connect(g); g.connect(this._actx.destination);
                const t = this._actx.currentTime;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(0.25, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
                o.start(t);
                o.stop(t + 0.36);
            } catch (e) { /* Ton nicht moeglich (Autoplay o.ae.) */ }
        },
        _esc(s) {
            const d = document.createElement("div");
            d.textContent = s;
            return d.innerHTML;
        }
    },

    preis(v) { return this.euro.format(v); },

    zeit(iso) {
        return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    },

    /* ---------- Anmeldung ----------
       Zwei Wege:
       1. Personen (Inhaber/Service/Kueche): Benutzername + Passwort (Basic Auth).
          Liegt im localStorage, gilt also tab-uebergreifend -> EINMAL anmelden
          reicht fuer Inhaber-, Service- und Kuechen-Ansicht.
       2. Geraete (Kuechen-Tablet, Kasse): Geraetetoken aus dem QR-Code,
          wird als Header "X-Device-Token" geschickt - kein Passwort noetig. */

    setAuth(user, pass) {
        try { localStorage.setItem("ox-auth", "Basic " + btoa(user + ":" + pass)); } catch (e) { /* ignore */ }
        this._me = null;
    },
    setDeviceToken(token) {
        try { localStorage.setItem("ox-device", token); } catch (e) { /* ignore */ }
        this._me = null;
    },
    deviceToken() {
        try { return localStorage.getItem("ox-device"); } catch (e) { return null; }
    },
    basicAuth() {
        try { return localStorage.getItem("ox-auth"); } catch (e) { return null; }
    },
    clearAuth() {
        try { localStorage.removeItem("ox-auth"); localStorage.removeItem("ox-device"); } catch (e) { /* ignore */ }
        this._me = null;
    },
    hasAuth() { return !!(this.basicAuth() || this.deviceToken()); },
    authHeader() {
        const device = this.deviceToken();
        if (device) return { "X-Device-Token": device };
        const basic = this.basicAuth();
        return basic ? { Authorization: basic } : {};
    },

    /* ---------- Wer bin ich? (Rolle + Laden) ---------- */

    async me() {
        if (!this._me) { this._me = await this.api("/api/me"); }
        return this._me;
    },

    roleText(role) {
        return { OWNER: "Inhaber", SERVICE: "Service/Kasse", KITCHEN: "Küche", WAITER: "Kellner" }[role] || role;
    },

    /* ---------- Laden-Design auch fuer die Personal-Ansichten -----------
       Auf Wunsch: nicht nur die Gaeste-Seite, ALLE Ansichten sollen wie das
       vom Inhaber gewaehlte Design aussehen (Farbe, Form, Schrift,
       Hell/Dunkel) - vorher hatten die Personal-Werkzeuge eine feste
       Marken-Farbe (#1f3d34) unabhaengig vom Laden. Nutzt denselben
       oeffentlichen Endpunkt wie die Gaeste-Seite (/api/guest/theme/{id}) -
       braucht keine besondere Rolle, jeder angemeldete Mitarbeiter kennt
       schon seine eigene restaurantId aus /api/me. */
    _fontFamilie: {
        BRICOLAGE: "Bricolage Grotesque", FRAUNCES: "Fraunces", SPACE_GROTESK: "Space Grotesk",
        INSTRUMENT_SERIF: "Instrument Serif", MANROPE: "Manrope", SORA: "Sora", DM_SERIF: "DM Serif Display"
    },
    _fontGoogleSegment: {
        FRAUNCES: "Fraunces:wght@400;600;700",
        SPACE_GROTESK: "Space+Grotesk:wght@400;500;700",
        INSTRUMENT_SERIF: "Instrument+Serif:ital@0;1",
        MANROPE: "Manrope:wght@400;600;700",
        SORA: "Sora:wght@400;600;700",
        DM_SERIF: "DM+Serif+Display:wght@400"
    },
    _geladeneFonts: new Set(["BRICOLAGE"]), // schon im <head> jeder Seite fest verlinkt

    _ladeFontFalls(fontKey) {
        if (this._geladeneFonts.has(fontKey)) return;
        const segment = this._fontGoogleSegment[fontKey];
        if (!segment) return;
        this._geladeneFonts.add(fontKey);
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://fonts.googleapis.com/css2?family=" + segment + "&display=swap";
        document.head.appendChild(link);
    },

    _hexZuRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    _luminanz(hex) {
        const [r, g, b] = this._hexZuRgb(hex).map((wert) => {
            const anteil = wert / 255;
            return anteil <= 0.03928 ? anteil / 12.92 : Math.pow((anteil + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    _textfarbeAuf(hex) {
        const lh = this._luminanz(hex);
        const kontrastSchwarz = (Math.max(lh, 0) + 0.05) / 0.05;
        const kontrastWeiss = 1.05 / (Math.min(lh, 1) + 0.05);
        return kontrastSchwarz >= kontrastWeiss ? "#000000" : "#ffffff";
    },

    applyLadenTheme(theme) {
        if (!theme) return;
        const wurzel = document.documentElement;
        if (/^#[0-9a-fA-F]{6}$/.test(theme.accentColor || "")) {
            wurzel.style.setProperty("--primary", theme.accentColor);
            wurzel.style.setProperty("--primary-text", this._textfarbeAuf(theme.accentColor));
        }
        if (theme.styleShape === "SOFT") {
            wurzel.style.setProperty("--radius-sm", "14px");
            wurzel.style.setProperty("--radius", "18px");
            wurzel.style.setProperty("--radius-lg", "26px");
        } else {
            wurzel.style.removeProperty("--radius-sm");
            wurzel.style.removeProperty("--radius");
            wurzel.style.removeProperty("--radius-lg");
        }
        const fontKey = this._fontFamilie[theme.displayFont] ? theme.displayFont : "BRICOLAGE";
        this._ladeFontFalls(fontKey);
        wurzel.style.setProperty("--font-display", '"' + this._fontFamilie[fontKey] + '", Georgia, serif');
        if (theme.darkMode) wurzel.setAttribute("data-theme", "dark");
        else wurzel.removeAttribute("data-theme");
    },

    /* Baut oben eine Leiste zum Umschalten zwischen den Ansichten.
       Der Inhaber sieht alle drei, Service und Kueche nur ihre eigene. */
    async buildNav(active) {
        let me;
        try { me = await this.me(); } catch (e) { return; }

        // Laden-Name statt "OrderXpress" oben - jede Seite hier hat einen
        // eigenen Laden (anders als platform.html/index.html).
        if (me.restaurantName) {
            const titleEl = document.getElementById("topbar-title");
            if (titleEl) titleEl.textContent = titleEl.textContent.replace(/^OrderXpress/, me.restaurantName);
            document.title = document.title.replace(/OrderXpress$/, me.restaurantName);
        }

        // Laden-Design (Farbe/Form/Schrift/Hell-Dunkel) auch hier - derselbe
        // oeffentliche Endpunkt wie die Gaeste-Seite, rein lesend.
        if (me.restaurantId) {
            try { this.applyLadenTheme(await this.api("/api/guest/theme/" + me.restaurantId)); }
            catch (e) { /* Design ist optional - Standard-Optik bleibt */ }
        }

        const all = [
            { key: "admin", href: "/admin.html", label: "Inhaber", roles: ["OWNER"] },
            { key: "stats", href: "/stats.html", label: "Statistik", roles: ["OWNER"] },
            { key: "service", href: "/service.html", label: "Service/Kasse", roles: ["OWNER", "SERVICE"] },
            { key: "kitchen", href: "/kitchen.html", label: "Küche", roles: ["OWNER", "KITCHEN"] }
        ].filter(l => l.roles.includes(me.role))
            // Laden ohne Kuechen-Bildschirm: Kuechen-Ansicht ausblenden
            .filter(l => l.key !== "kitchen" || me.kitchenDisplayEnabled !== false);

        let bar = document.getElementById("ox-nav");
        if (!bar) {
            bar = document.createElement("div");
            bar.id = "ox-nav";
            const main = document.querySelector("main");
            if (!main) return;
            main.insertBefore(bar, main.firstChild);
        }
        bar.className = "ox-nav";
        bar.innerHTML = "";

        for (const link of all) {
            const a = document.createElement("a");
            a.href = link.href;
            a.textContent = link.label;
            if (link.key === active) a.className = "current";
            bar.appendChild(a);
        }
        const info = document.createElement("span");
        info.className = "muted";
        info.style.marginLeft = "auto";
        info.textContent = me.restaurantName + " · " + this.roleText(me.role);
        bar.appendChild(info);
    },

    /* Personal-Ansicht OHNE Login-Flash aufbauen: ist eine Anmeldung (Passwort
       oder Geraetetoken) vorhanden, wird sofort losgelegt (onReady) und im
       Hintergrund geprueft. Gilt die Anmeldung nicht mehr (401/403), wird sie
       verworfen und die Seite neu geladen - erst dann erscheint die Login-Maske
       (onLogin). So sieht der Inhaber beim Umschalten nie kurz die Anmeldung. */
    async ensureAuth(onReady, onLogin) {
        if (!this.hasAuth()) { onLogin(); return; }
        onReady();
        try {
            await this.me();
        } catch (e) {
            if (e.status === 401 || e.status === 403) {
                this.clearAuth();
                location.reload();
            }
        }
    },

    /* ---------- API-Aufrufe ---------- */

    async api(path, options = {}) {
        const res = await fetch(path, {
            ...options,
            headers: { "Content-Type": "application/json", ...this.authHeader(), ...(options.headers || {}) }
        });
        if (res.status === 204) return null;
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { /* keine JSON-Antwort */ }
        if (!res.ok) {
            const msg = body && body.detail ? body.detail : "Fehler " + res.status;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }
        return body;
    },

    /* ---------- Kleine Einblend-Meldung ---------- */

    toast(msg, isError = false) {
        let el = document.getElementById("toast");
        if (!el) {
            el = document.createElement("div");
            el.id = "toast";
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.className = "show" + (isError ? " error" : "");
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { el.className = ""; }, 3500);
    },

    /* ---------- Live-Ereignisse (SSE) ----------
       Der eingebaute EventSource kann keinen Basic-Auth-Header senden,
       deshalb lesen wir den Ereignis-Strom selbst per fetch.
       Verbindet sich bei Abbruch automatisch neu.                     */

    connectSse(path, onEvent, onStatus) {
        let stopped = false;

        const run = async () => {
            while (!stopped) {
                try {
                    const res = await fetch(path, {
                        headers: { Accept: "text/event-stream", ...this.authHeader() }
                    });
                    if (!res.ok || !res.body) throw new Error("SSE-Verbindung fehlgeschlagen");
                    if (onStatus) onStatus(true);

                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });

                        let idx;
                        while ((idx = buffer.indexOf("\n\n")) >= 0) {
                            const chunk = buffer.slice(0, idx);
                            buffer = buffer.slice(idx + 2);
                            let event = "message", data = "";
                            for (const line of chunk.split("\n")) {
                                if (line.startsWith("event:")) event = line.slice(6).trim();
                                else if (line.startsWith("data:")) data += line.slice(5).trim();
                            }
                            if (event !== "ping" && event !== "connected") {
                                try { onEvent(event, data ? JSON.parse(data) : null); }
                                catch (e) { onEvent(event, data); }
                            }
                        }
                    }
                } catch (e) {
                    /* Verbindung weg -> unten neu versuchen */
                }
                if (onStatus) onStatus(false);
                if (!stopped) await new Promise(r => setTimeout(r, 5000));
            }
        };
        run();
        return { stop() { stopped = true; } };
    }
};
