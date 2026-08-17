"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, ViewTransition } from "react";
import { UserIcon } from "@/components/icons";

type AppHeaderProps = {
  activePage: "about";
};

export function AppHeader({ activePage }: AppHeaderProps) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    let animationFrame = 0;
    let latestScrollTop = window.scrollY;

    const updateHeader = () => {
      animationFrame = 0;
      setIsCompact((current) =>
        current ? latestScrollTop > 16 : latestScrollTop > 48,
      );
    };
    const handleScroll = (event: Event) => {
      latestScrollTop = event.target instanceof HTMLElement
        ? event.target.scrollTop
        : window.scrollY;
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateHeader);
    };

    updateHeader();
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true });
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <header className="generation-header" data-compact={isCompact}>
      <div className="generation-header-inner">
        <Link href="/" className="generation-brand" aria-label="Hermes — открыть чат">
          <Image
            src="/yahya.svg"
            alt=""
            width={28}
            height={28}
            unoptimized
            className="generation-brand-logo"
          />
          <span>Hermes</span>
        </Link>

        <nav className="generation-nav" aria-label="Основная навигация">
          <Link href="/">Чат</Link>
          {activePage === "about" ? (
            <ViewTransition
              name="generation-nav-active"
              share={{ "header-section": "generation-nav-active", default: "none" }}
              default="none"
            >
              <span aria-current="page">О нас</span>
            </ViewTransition>
          ) : null}
        </nav>

        <Link href="/profile" className="generation-profile-link">
          <UserIcon className="size-[17px]" />
          <span>Профиль</span>
        </Link>
      </div>
    </header>
  );
}
