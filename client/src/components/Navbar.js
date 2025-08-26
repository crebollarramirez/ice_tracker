"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const pathname = usePathname() || "/en"; // fallback to en when pathname isn't available
  const locale = pathname.split("/")[1] || "en";

  return (
    <div className="w-full">
      <nav className="w-full flex justify-between items-center">
        <div className="flex gap-4">
          <Link 
            href={`/${locale}/`} 
            className={`transition-colors duration-200 ${
              pathname === `/${locale}` || pathname === `/${locale}/`
                ? "text-red-600 font-bold underline"
                : "text-white hover:text-red-500"
            }`}
          >
            Home
          </Link>
          <Link 
            href={`/${locale}/resources`} 
            className={`transition-colors duration-200 ${
              pathname === `/${locale}/resources`
                ? "text-red-600 font-bold underline"
                : "text-white hover:text-red-500"
            }`}
          >
            Resources
          </Link>
        </div>

        <LanguageSwitcher />
      </nav>
    </div>
  );
}
