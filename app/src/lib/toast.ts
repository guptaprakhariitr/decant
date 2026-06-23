import { useEffect, useState } from "react";

// Minimal toast bus — no dependency. pushToast() from anywhere; <Toaster/> renders them.
export type Toast = { id: number; msg: string; kind: "ok" | "err" };
let toasts: Toast[] = [];
const subs = new Set<() => void>();
let seq = 0;

function emit() {
  for (const f of subs) f();
}

export function pushToast(msg: string, kind: "ok" | "err" = "ok") {
  const id = ++seq;
  toasts = [...toasts, { id, msg, kind }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4200);
}

export function useToasts(): Toast[] {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
  return toasts;
}
