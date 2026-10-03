"use client";

import { useEffect } from "react";

/* Registers the offline worker. Skipped in development so it does not interfere with hot reload. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
