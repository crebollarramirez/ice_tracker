"use client";

import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleLanguageChange = (newLocale) => {
    // Replace the current locale in the pathname with the new one
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <div className="flex items-center space-x-2 text-sm font-medium">
      <button
        onClick={() => handleLanguageChange("en")}
        className={`transition-colors duration-200 cursor-pointer ${
          locale === "en"
            ? "text-red-600 font-bold underline"
            : "text-gray-400 hover:text-red-500"
        }`}
        aria-label="Switch to English"
      >
        English
      </button>
      <span className="text-gray-400">|</span>
      <button
        onClick={() => handleLanguageChange("es")}
        className={`transition-colors duration-200 cursor-pointer ${
          locale === "es"
            ? "text-red-600 font-bold underline"
            : "text-gray-400 hover:text-red-500"
        }`}
        aria-label="Cambiar a Español"
      >
        Español
      </button>
    </div>
  );
}
