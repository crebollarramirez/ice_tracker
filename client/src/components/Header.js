"use client";

import { Shield } from "lucide-react";
import { Navbar } from "./Navbar";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40 supports-[backdrop-filter]:bg-background/60 px-4 md:px-0" >
      <div className="container mx-auto">
        <div className="flex items-center justify-between py-3 md:py-6">
          {/* Logo - always visible */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg md:rounded-xl">
              <Shield className="w-4 h-4 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-base md:text-2xl font-bold text-foreground">
                iceinmyarea.org
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                The most reliable way to track ICE activity near you.
              </p>
            </div>
          </div>

          {/* Mobile menu toggle - passed to Navbar */}
          <Navbar />
        </div>
      </div>
    </header>
  );
};
