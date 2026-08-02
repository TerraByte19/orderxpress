/* Startseite - reine Linkliste, kein Zustand. Bindet das Design-System ein
   und meldet den Service Worker an. */
import "../styles/app.css";
import "../styles/fonts";
import "./index.css";
import { registriereServiceWorker } from "../lib/pwa";

registriereServiceWorker();
