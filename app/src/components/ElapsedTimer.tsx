import { useEffect, useRef, useState } from "react";

// Live elapsed-seconds counter for loading screens. Counts up from mount until unmounted.
export function ElapsedTimer({ className }: { className?: string }) {
  const start = useRef(Date.now());
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((Date.now() - start.current) / 1000), 150);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{s.toFixed(0)}s</span>;
}
