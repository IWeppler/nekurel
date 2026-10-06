"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MutableRefObject,
} from "react";

export function AutoSaveForm({
  children,
  onSave,
  changes,
  registerRef,
  paused,
}: {
  children: ReactNode;
  onSave: (form: HTMLFormElement) => Promise<boolean>;
  changes: string;
  paused: boolean;
  registerRef: MutableRefObject<() => Promise<boolean>>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const save = useRef(onSave);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flight = useRef<Promise<boolean> | null>(null);
  const previous = useRef(changes);
  const pausedRef = useRef(paused);
  const generation = useRef(0);
  const [status, setStatus] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  useEffect(() => {
    save.current = onSave;
    pausedRef.current = paused;
  });

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (flight.current) return flight.current;
    if (pausedRef.current) return false;
    if (!dirty.current || !form.current) return true;
    const version = generation.current;
    dirty.current = false;
    const current = form.current;
    const pending = save.current(current).catch(() => false);
    flight.current = pending;
    setStatus("saving");
    const success = await pending;
    flight.current = null;
    dirty.current = !success || generation.current !== version;
    setStatus(success ? (dirty.current ? "pending" : "saved") : "error");
    return success;
  }, []);
  const schedule = useCallback(() => {
    dirty.current = true;
    generation.current += 1;
    setStatus("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, 900);
  }, [flush]);
  useEffect(() => {
    registerRef.current = flush;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      registerRef.current = async () => true;
    };
  }, [flush, registerRef]);
  useEffect(() => {
    if (previous.current !== changes) {
      previous.current = changes;
      schedule();
    }
  }, [changes, schedule]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current || flight.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (!paused && dirty.current && !flight.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 900);
    }
  }, [paused, flush]);
  return (
    <form
      ref={form}
      onChange={schedule}
      onSubmit={(event) => {
        event.preventDefault();
        void flush();
      }}
    >
      <p className={`autosave-status ${status}`} role="status">
        {status === "idle"
          ? ""
          : status === "pending"
            ? "Cambios pendientes…"
            : status === "saving"
              ? "Guardando…"
              : status === "saved"
                ? "Todos los cambios guardados"
                : "No se guardaron los cambios. Revisá el error e intentá de nuevo."}
        {status === "error" && (
          <button type="button" onClick={() => void flush()}>
            Reintentar
          </button>
        )}
      </p>
      <fieldset className="autosave-fields" disabled={status === "saving"}>
        {children}
      </fieldset>
    </form>
  );
}
