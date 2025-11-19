"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Navbar } from "./Navbar";
import { useTranslations } from "next-intl";

export const Header = () => {

  const t = useTranslations("header");
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40 supports-[backdrop-filter]:bg-background/60 px-4 md:px-0">
      <div className="container mx-auto">
        <div className="flex items-center justify-between py-3 md:py-6">
          {/* Logo - always visible */}
          <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-6 h-6 md:w-10 md:h-10">
              <Image
                src="/app-icon.png"
                alt="ICE in My Area Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-base md:text-2xl font-bold text-foreground">
                iceinmyarea.org
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
            {t('description')}
              </p>
            </div>
          </Link>

          {/* Mobile menu toggle - passed to Navbar */}
          <Navbar />
        </div>
      </div>
    </header>
  );
};
