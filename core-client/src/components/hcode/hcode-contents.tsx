"use client";

import { useEffect, useState } from "react";

type HcodeContentsItem = {
  href: `#${string}`;
  label: string;
};

type HcodeContentsProps = {
  label: string;
  items: HcodeContentsItem[];
};

export function HcodeContents({ label, items }: HcodeContentsProps) {
  const [activeHref, setActiveHref] = useState(items[0]?.href ?? "");

  useEffect(() => {
    let frame: number | null = null;

    function updateActiveSection() {
      frame = null;
      const marker = Math.max(96, window.innerHeight * 0.22);
      let nextHref = items[0]?.href ?? "";

      for (const item of items) {
        const section = document.querySelector<HTMLElement>(item.href);
        if (!section || section.getBoundingClientRect().top > marker) break;
        nextHref = item.href;
      }

      const atPageEnd =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atPageEnd) nextHref = items.at(-1)?.href ?? nextHref;
      setActiveHref(nextHref);
    }

    function scheduleUpdate() {
      if (frame === null) frame = window.requestAnimationFrame(updateActiveSection);
    }

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [items]);

  return (
    <aside className="hcode-sidebar">
      <span className="hcode-sidebar-label">{label}</span>
      <nav className="hcode-contents" aria-label={label}>
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            data-active={activeHref === item.href}
            aria-current={activeHref === item.href ? "location" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
