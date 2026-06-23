import { useToasts } from "../lib/toast.ts";
import { Icon } from "./Icon.tsx";

export function Toaster() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <Icon name={t.kind === "err" ? "alert" : "checkCircle"} size={15} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
