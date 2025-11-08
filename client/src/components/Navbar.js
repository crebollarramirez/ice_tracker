"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/utils/utils";
import { Link } from "@/i18n/navigation";
import DonateButton from "./Donate/DonateButton";
import LanguageSwitcher from "./LanguageSwitcher";

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Check if the current path matches the route
  const isActive = (path) => {
    if (path === "/") {
      // For home, check if we're at the root or locale root
      return pathname === "/" || pathname.match(/^\/[a-z]{2}\/?$/);
    }
    // For other routes, check if pathname includes the path
    return pathname.includes(path);
  };

  return (
    <div className="relative ">
      {/* Desktop Navigation */}
      <nav className="hidden md:block ">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 gap-4">
            {/* Left: Navigation Links */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isActive("/")
                    ? "text-primary font-semibold"
                    : "text-foreground hover:text-primary"
                )}
              >
                Home
              </Link>
              <Link
                href="/about"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isActive("/about")
                    ? "text-primary font-semibold"
                    : "text-foreground hover:text-primary"
                )}
              >
                About
              </Link>
              <Link
                href="/resources"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isActive("/resources")
                    ? "text-primary font-semibold"
                    : "text-foreground hover:text-primary"
                )}
              >
                Resources
              </Link>
              <Link
                href="/verifiers"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isActive("/verifiers")
                    ? "text-primary font-semibold"
                    : "text-foreground hover:text-primary"
                )}
              >
                Verifiers
              </Link>
            </div>

            {/* Right: Language & Donate */}
            <div className="flex items-center gap-3 ml-auto">
              <LanguageSwitcher />
              <DonateButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Toggle Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2 text-foreground hover:bg-secondary rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <Menu className="w-5 h-5" />
        )}
      </button>

      {/* Mobile Menu Dropdown */}
      <div
        className={cn(
          "md:hidden fixed left-0 right-0 top-[var(--header-height)] z-50 border-t border-border/40 bg-background shadow-lg overflow-hidden transition-all duration-500 ease-out",
          mobileMenuOpen
            ? "max-h-[calc(100vh-var(--header-height,72px))] opacity-100"
            : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="container mx-auto px-4 py-4 overflow-y-auto max-h-[calc(100vh-var(--header-height,72px))]">
          {/* Navigation Links */}
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className={cn(
                "text-sm font-medium py-2 px-3 rounded-lg transition-colors",
                isActive("/")
                  ? "text-primary font-semibold bg-secondary"
                  : "text-foreground hover:text-primary hover:bg-secondary"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/about"
              className={cn(
                "text-sm font-medium py-2 px-3 rounded-lg transition-colors",
                isActive("/about")
                  ? "text-primary font-semibold bg-secondary"
                  : "text-foreground hover:text-primary hover:bg-secondary"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="/resources"
              className={cn(
                "text-sm font-medium py-2 px-3 rounded-lg transition-colors",
                isActive("/resources")
                  ? "text-primary font-semibold bg-secondary"
                  : "text-foreground hover:text-primary hover:bg-secondary"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              Resources
            </Link>
            <Link
              href="/verifiers"
              className={cn(
                "text-sm font-medium py-2 px-3 rounded-lg transition-colors",
                isActive("/verifiers")
                  ? "text-primary font-semibold bg-secondary"
                  : "text-foreground hover:text-primary hover:bg-secondary"
              )}
              onClick={() => setMobileMenuOpen(false)}
            >
              Verifiers
            </Link>
          </div>

          <div className="flex flex-col justify-center items-center gap-2">
            <div className="pt-2 border-t border-border w-full flex justify-center">
              <LanguageSwitcher />
            </div>

            {/* Donate Button */}
            <DonateButton />
          </div>
        </div>
      </div>
    </div>
  );
};
