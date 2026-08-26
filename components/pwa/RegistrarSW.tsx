"use client";

import { useEffect } from "react";

/**
 * Registra el service worker que hace la wiki instalable y navegable sin
 * conexión. Sólo en producción: en desarrollo, una caché intermedia hace que
 * los cambios no se vean y se pierde media tarde averiguando por qué.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // Tras la carga, para no competir por ancho de banda con el primer render.
    const registrar = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
  }, []);

  return null;
}
