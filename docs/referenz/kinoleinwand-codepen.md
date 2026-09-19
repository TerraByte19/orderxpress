# Kinoleinwand — Original-Vorlage (CodePen)

**Herkunft:** Adham hat diesen Code am 27.08.2026 in der OrderXpress-Sitzung
`42764872-f084-40d3-bb52-e78fbee24b9d` eingefuegt, mit den Worten
„das ist der code deins ist dreck nim das". Er lag danach NUR im
Sitzungsprotokoll und in keiner Datei — am 19.09.2026 wieder herausgesucht
und hier abgelegt, damit das nicht noch einmal passiert.

**Achtung, fremdes Material:** Die Falten-Textur des Originals haengt an
einem fremden Bild auf `s3-us-west-2.amazonaws.com/s.cdpn.io/950358/curtain.svg`.
Das wird bewusst NICHT verlinkt und nicht kopiert. OrderXpress hat dafuer eine
eigene Falten-Textur als eingebettetes SVG (siehe `frontend/src/pages/guest/vorhang.css`).

## Was davon in OrderXpress steckt

Uebernommen wurde die Bewegung der Vorhanghaelften — Schwenk statt Schieben:
`translate` + `rotate` + `scale` mit Ursprung an der oberen inneren Ecke.
OrderXpress fuehrt sie schneller und flacher aus (750 ms, 12 Grad, scale .35/1.35
gegen 4 s, 20 Grad, scale 0/2), weil ein Gast am Tisch bestellen will und nicht
auf eine Show wartet.

## Nachtrag 19.09.2026 — der Saal ist wieder raus

Leinwand-Ausdehnung, dunkler Saal und Buehnenlicht waren kurzzeitig als
Stil `KINO` gebaut und sind nach Rueckmeldung wieder entfallen:

- Der dunkle Saal **engte den Vorhang ein**, statt ihn zu rahmen. Auf einem
  hochkant gehaltenen Handy blieb vom Vorhang ein kleines Rechteck mitten im
  Schwarz. Umdrehen (Fenster hinter den Vorhang) half nur teilweise — beim
  Aufgehen stand dann ein schwarzer Rand um die Karte.
- Das **Anstrahl-Licht** (`filter: brightness(175%)`) verfaelschte die Farbe,
  die der Laden eingestellt hatte: `#380000` kam als helleres Rot heraus.
- Das **Buehnenlicht** war ohne den Saal gegenstandslos.

`KINO` ist seitdem der langsame, weit ausgeholte Schwenk: dieselbe Bewegung
wie `VORHANG`, nur 1500 ms statt 750 ms. Die Abschnitte unten beschreiben
weiterhin die Vorlage, nicht den heutigen Code.

## Was von der Vorlage NICHT umgesetzt ist

Genau der Teil, der die Vorlage zur *Kinoleinwand* macht:

1. **`#scene` dehnt sich aus** — ein kleines, rot umrandetes Bild-Fenster
   (1200x600, schwarz) waechst in zwei Stufen auf volle Breite und Hoehe
   (`expand-scene-horizontaly` 2,5 s, dann `expand-scene-verticaly` 1,5 s).
   Das ist die Leinwand.
2. **`.ground`** — ein riesiger Kreis mit weissem Leuchten, der von unten
   aufsteigt (`ground-rising`, 6 s). Buehnenlicht.
3. **`filter: brightness(180% -> 100%)`** auf den Haelften waehrend des
   Oeffnens — der Vorhang ist zuerst angestrahlt und verliert das Licht,
   waehrend er aufgeht.
4. **Titel-Auftritt** — Zoom, Einblenden und ein dauerhaftes Glimmen
   (`text-glowing`, `alternate`, unendlich).

## Original (unveraendert, ohne den Bild-Link zu benutzen)

```css
@import url("https://fonts.googleapis.com/css?family=Open+Sans:800|Roboto+Condensed:700i");

body {
    width: 100%;
    min-height: 600px;
    height: 100%;
    padding: 0;
    margin: 0;
}

#starter {
    z-index: 1;
    position: absolute;
    top: 50%;
    left: 50%;
    width: 300px;
    height: 50px;
    margin-top: -25px;
    margin-left: -150px;
    text-align: center;
    font-family: 'Roboto Condensed', sans-serif;
    font-size: 2em;
    font-weight: 600;
    cursor: pointer;
}

#scene {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 1200px;
    height: 600px;
    overflow: hidden;
    margin-top: -300px;
    margin-left: -600px;
    background-color: rgb(0,0,0);
    box-shadow: 0 0 0 2px red inset;
}
#curtain {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
}

#curtain .left,
#curtain .right {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    filter: brightness(180%);
    background-image: url("https://s3-us-west-2.amazonaws.com/s.cdpn.io/950358/curtain.svg");
    background-size: cover;
    background-repeat: no-repeat;
}

#curtain .left {
    left: 0;
    transform-origin: top right;
}
#curtain .right {
    left: 50%;
    transform-origin: top left;
}

.ground {
    position: absolute;
    left: 50%;
    top: 133%;
    width: 10000px;
    height: 10000px;
    margin-left: -5000px;
    border-radius: 100%;
    box-shadow: 0 0 100px 100px white;
}

h1 {
    position: absolute;
    left: 50%;
    top: 50%;
    display: block;
    width: 500px;
    height: 150px;
    margin-top: -90px;
    margin-left: -250px;
    text-align: center;
    font-family: 'Open Sans', sans-serif;
    font-size: 10em;
    color: white;
    transform: scale(0.75);
    opacity: 0;
}

/* **********
    opening
********** */

#scene.expand {
    width: 140%;
    left: -20%;
    margin-left: 0;
    background-color: rgb(32,32,32);
    box-shadow: 0 0 0 0 white inset;
    animation-fill-mode: forwards;
    animation-name: expand-scene-horizontaly, expand-scene-verticaly;
    animation-duration: 2.5s, 1.5s;
    animation-timing-function: ease-in-out, ease-in-out;
    animation-delay: 0s, 2.5s;
    animation-iteration-count: 1, 1;
    animation-direction: normal, normal;
}

#curtain.open .left,
#curtain.open .right {
    filter: brightness(100%);
}
#curtain.open .left {
    animation-fill-mode: forwards;
    animation-name: curtain-opening, left-curtain-opening;
    animation-duration: 2s, 4s;
    animation-timing-function: ease-in-out, ease-in-out;
    animation-delay: 0s, 0s;
    animation-iteration-count: 1, 1;
    animation-direction: normal, normal;
}
#curtain.open .right {
    animation-fill-mode: forwards;
    animation-name: curtain-opening, right-curtain-opening;
    animation-duration: 2s, 4s;
    animation-timing-function: ease-in-out, ease-in-out;
    animation-delay: 0s, 0s;
    animation-iteration-count: 1, 1;
    animation-direction: normal, normal;
}

#scene.expand .ground {
    animation-fill-mode: forwards;
    animation-name: ground-rising;
    animation-duration: 6s;
    animation-timing-function: ease-out;
    animation-delay: 0s;
    animation-iteration-count: 1;
    animation-direction: normal;
}

#scene.expand h1 {
    animation-fill-mode: forwards;
    animation-name: text-zoom, text-fade-in, text-glowing;
    animation-duration: 5s, 1s, 1s;
    animation-timing-function: ease-out, ease-in-out, ease-in-out;
    animation-delay: 3s, 3s, 0s;
    animation-iteration-count: 1, 1, infinite;
    animation-direction: normal, normal, alternate;
}

.fade-out {
    animation-fill-mode: forwards;
    animation-name: fade-out;
    animation-duration: 1s;
    animation-timing-function: ease-in;
    animation-delay: 0s;
    animation-iteration-count: 1;
    animation-direction: normal;
}

/* **********
    animations
********** */

@keyframes expand-scene-horizontaly { /* 2.5
    s */
    from {     
        width: 1200px;
        left: 50%;
        margin-left: -600px;
        background-color: rgb(0,0,0);
        box-shadow: 0 0 0 2px red inset;
    }
    to {
        width: 140%;
        left: -20%;
        margin-left: 0;
        background-color: rgb(32,32,32);
        box-shadow: 0 0 0 0 white inset;
    }
}

@keyframes expand-scene-verticaly { /* 1.5s */
    from {     
        top: 50%;
        height: 600px;
        margin-top: -300px;
    }
    to {
        top: 0;
        height: 100%;
        margin-top: 0;
    }
}

@keyframes curtain-opening { /* 2s */
    from { filter: brightness(180%); }
    to { filter: brightness(100%); }
}

@keyframes left-curtain-opening { /* 4s */ 
    from { transform: translate(0) rotate(0) scale(1,1); }
    to { transform: translate(-100%) rotate(20deg) scale(0,2); }
}

@keyframes right-curtain-opening { /* 4s */
    from { transform: translate(0) rotate(0) scale(1,1); }
    to { transform: translate(100%) rotate(-20deg) scale(0,2); }
}

@keyframes ground-rising {
    from { top: 133%; }
    to { top: 105%; }
}

@keyframes text-zoom {
    from { transform: scale(0.75); }
    to { transform: scale(1); }
}

@keyframes text-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes text-glowing {
    from { text-shadow: 0 0 10px white; }
    to { text-shadow: 0 0 10px white, 0 0 20px white, 0 0 30px dodgerblue; }
}

@keyframes fade-out {
    from { color: black; opacity: 1; }
    to { color: white; opacity: 0; }
} #starter press enter
#scene
    #curtain
        %h1 TADA!
        .ground
        .left
        .right //document.getElementById("starter").focus();
document.body.addEventListener('onload', focus());
document.addEventListener('keydown', detectSpaceKey);

function detectSpaceKey(event)
{
    if(event.keyCode == 13) {
        showTime();
    }
}

function showTime()
{
    var curtain = document.getElementById("curtain");
    curtain.className = "open";
    
    var scene = document.getElementById("scene");
    scene.className = "expand";
    
    var starter = document.getElementById("starter");
    starter.className = "fade-out";
    
    setTimeout(function() {
        starter.style.display = 'none';
    }, 2000);
}
```
