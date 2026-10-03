"use client";

import { useEffect } from "react";

/** F7: daftarkan /sw.js (offline timeline portal). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
