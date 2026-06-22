"use client";
import { useEffect, useRef, useState } from "react";

interface FlashOnChangeProps {
  watchKey: unknown;
  children: React.ReactNode;
}

/** Wraps children in a span and plays an amber-glow animation whenever watchKey changes after the initial mount. */
export function FlashOnChange({ watchKey, children }: FlashOnChangeProps) {
  const [flashing, setFlashing] = useState(false);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    let raf1: number;
    let raf2: number;
    let timer: ReturnType<typeof setTimeout>;

    setFlashing(false);
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFlashing(true);
        timer = setTimeout(() => setFlashing(false), 500);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [watchKey]);

  return <span className={flashing ? "flash-amber" : undefined}>{children}</span>;
}
