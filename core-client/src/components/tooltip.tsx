"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Tooltip({
  children,
  content,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!show || disabled || !ref.current) return;

    const updatePosition = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setCoords({
        x: rect.right + 12,
        y: rect.top + rect.height / 2,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [show, disabled]);

  return (
    <>
      <div
        ref={ref}
        className={`tooltip-anchor ${className}`}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onPointerDown={() => setShow(false)}
      >
        {children}
      </div>
      {show &&
        !disabled &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="app-tooltip"
            style={{
              left: coords.x,
              top: coords.y,
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
