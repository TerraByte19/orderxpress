/* QR-Login per Kamera: oeffnet die Kamera, liest einen Geraete-QR-Code
   (Inhalt: .../d/<activationToken>), tauscht ihn gegen den Geraetetoken und
   leitet je nach Rolle weiter. So kann sich Kasse/Kueche/Kellner anmelden,
   ohne den QR mit der separaten Handy-Kamera oeffnen zu muessen.

   Wichtig: Kamera-Zugriff (getUserMedia) geht nur ueber HTTPS oder localhost. */
const QRScan = {

    stream: null,
    raf: null,
    video: null,
    canvas: null,
    ctx: null,

    open() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof jsQR !== "function") {
            OX.toast("Kamera-Scan hier nicht verfügbar (nur über HTTPS/localhost). Bitte den QR mit der Handy-Kamera öffnen.", true);
            return;
        }
        this.buildOverlay();
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then((stream) => {
                this.stream = stream;
                this.video.srcObject = stream;
                this.video.setAttribute("playsinline", "");
                this.video.muted = true;
                this.video.play();
                this.raf = requestAnimationFrame(() => this.tick());
            })
            .catch(() => this.setHint("Kein Kamerazugriff. Bitte die Kamera erlauben oder den QR mit der Handy-Kamera öffnen."));
    },

    tick() {
        if (!this.video) return;
        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            const w = this.video.videoWidth, h = this.video.videoHeight;
            if (w && h) {
                this.canvas.width = w;
                this.canvas.height = h;
                this.ctx.drawImage(this.video, 0, 0, w, h);
                const img = this.ctx.getImageData(0, 0, w, h);
                const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
                if (code && code.data) { this.onDecoded(code.data); return; }
            }
        }
        this.raf = requestAnimationFrame(() => this.tick());
    },

    async onDecoded(text) {
        const token = this.extractToken(text);
        if (!token) { this.setHint("QR erkannt, aber kein gültiger Anmelde-Code. Weiter scannen …"); this.raf = requestAnimationFrame(() => this.tick()); return; }
        this.close();
        try {
            const res = await OX.api("/api/device/activate/" + encodeURIComponent(token), { method: "POST" });
            OX.clearAuth();
            OX.setDeviceToken(res.deviceToken);
            OX.toast(res.label + " · " + OX.roleText(res.role) + " angemeldet");
            const target = res.role === "KITCHEN" ? "/kitchen.html"
                : res.role === "WAITER" ? "/waiter.html"
                : "/service.html";
            location.href = target;
        } catch (e) {
            OX.toast(e.status === 404 ? "Dieser QR-Code ist ungültig oder schon benutzt." : (e.message || "Fehler"), true);
        }
    },

    /* Aus dem QR-Inhalt den Token holen: entweder aus .../d/<token> oder ein reiner Token. */
    extractToken(text) {
        const s = String(text).trim();
        const i = s.indexOf("/d/");
        if (i >= 0) return decodeURIComponent(s.slice(i + 3).split(/[/?#]/)[0]);
        return /^[A-Za-z0-9_-]{8,}$/.test(s) ? s : null;
    },

    buildOverlay() {
        let ov = document.getElementById("qr-overlay");
        if (ov) ov.remove();
        ov = document.createElement("div");
        ov.id = "qr-overlay";
        ov.innerHTML =
            "<div class='qr-box'>" +
            "<video id='qr-video' playsinline></video>" +
            "<div class='qr-frame'></div>" +
            "<p id='qr-hint'>Halte den QR-Code in den Rahmen.</p>" +
            "<button class='ghost' id='qr-close'>Schließen</button>" +
            "</div>";
        document.body.appendChild(ov);
        this.video = document.getElementById("qr-video");
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
        document.getElementById("qr-close").onclick = () => this.close();
    },

    setHint(t) { const el = document.getElementById("qr-hint"); if (el) el.textContent = t; },

    close() {
        if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
        if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
        this.video = null;
        const ov = document.getElementById("qr-overlay");
        if (ov) ov.remove();
    }
};
