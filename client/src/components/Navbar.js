"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import DonateButton from "./Donate/DonateButton";
import HamburgerButton from "./HamburgerButton";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname() || "/en"; // fallback to en when pathname isn't available
  const locale = pathname.split("/")[1] || "en";

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="w-full mt-0 p-1 md:mt-2 md:p-0">
      <nav className="w-full flex justify-between items-center">
        {/* Desktop Navigation */}
        <div className="hidden md:flex gap-4">
          <Link
            href={`/${locale}/`}
            className={`transition-colors duration-200 ${
              pathname === `/${locale}` || pathname === `/${locale}/`
                ? "text-red-600 font-bold underline"
                : "text-gray-400 hover:text-red-500"
            }`}
          >
            Home
          </Link>
          <Link
            href={`/${locale}/resources`}
            className={`transition-colors duration-200 ${
              pathname === `/${locale}/resources`
                ? "text-red-600 font-bold underline"
                : "text-gray-400 hover:text-red-500"
            }`}
          >
            Resources
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <HamburgerButton
          isOpen={isMobileMenuOpen}
          onClick={toggleMobileMenu}
          className="md:hidden"
          ariaLabel="Toggle mobile menu"
        />

        {/* Desktop Right Side Items */}
        <div className="hidden md:flex flex-row gap-4">
          <LanguageSwitcher />
          <DonateButton />
        </div>

        {/* Mobile Right Side Items (always visible) */}
        <div className="md:hidden flex flex-row gap-4">
          <LanguageSwitcher />
          <DonateButton />
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`md:hidden fixed inset-0 z-50 backdrop-blur-sm bg-black/25 transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={toggleMobileMenu}
      >
        <div
          className={`absolute top-0 left-0 w-64 h-full bg-black/50 shadow-lg transform transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Menu Header with Close Button */}
          <div className="flex justify-between items-center p-4 border-b border-gray-600">
            <HamburgerButton
              isOpen={true}
              onClick={toggleMobileMenu}
              ariaLabel="Close mobile menu"
            />
          </div>

          {/* Mobile Menu Content */}
          <div className="p-4">
            <Link
              href={`/${locale}/`}
              className={`block py-3 px-4 text-lg transition-colors duration-200 ${
                pathname === `/${locale}` || pathname === `/${locale}/`
                  ? "text-red-600 font-bold"
                  : "text-gray-400 hover:text-red-500"
              }`}
              onClick={toggleMobileMenu}
            >
              Home
            </Link>
            <Link
              href={`/${locale}/resources`}
              className={`block py-3 px-4 text-lg transition-colors duration-200 ${
                pathname === `/${locale}/resources`
                  ? "text-red-600 font-bold"
                  : "text-gray-400 hover:text-red-500"
              }`}
              onClick={toggleMobileMenu}
            >
              Resources
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
