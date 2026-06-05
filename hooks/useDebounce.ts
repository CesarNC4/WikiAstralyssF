"use client";

import { useEffect, useState } from "react";

/** Devuelve el valor tras `delay` ms sin cambios (§8 — debounce de búsqueda). */
export function useDebounce<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
