"use client";
import { useEffect, useRef, useState } from "react";

export default function AnimatedNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const [current, setCurrent] = useState(value);
  const [dir, setDir] = useState<"Up" | "Down" | null>(null);
  const prevRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (value === prevRef.current) return;
    const prev = parseFloat(String(prevRef.current));
    const next = parseFloat(String(value));
    setDir(!isNaN(prev) && !isNaN(next) ? (next > prev ? "Up" : "Down") : "Down");
    setCurrent(value);
    prevRef.current = value;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDir(null), 380);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  return (
    <span
      key={String(current)}
      className={`inline-block overflow-hidden ${className ?? ""}`}
      style={
        dir
          ? { animation: `numScroll${dir} 0.32s cubic-bezier(0.22, 1, 0.36, 1) both` }
          : undefined
      }
    >
      {current}
    </span>
  );
}
