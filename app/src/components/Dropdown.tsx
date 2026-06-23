import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.tsx";

// A real open/close select. Click to open, click an option or outside to close.
export function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="dd" ref={ref}>
      <button className={`dd-btn ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span className="dd-label">{label}</span>
        <b>{value}</b>
        <Icon name="chevron" size={14} className="dd-chev" />
      </button>
      {open && (
        <div className="dd-menu">
          {options.map((o) => (
            <button
              key={o}
              className={`dd-opt ${o === value ? "sel" : ""}`}
              onClick={() => {
                onChange?.(o);
                setOpen(false);
              }}
            >
              {o === value && <Icon name="check" size={14} />}
              <span>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
