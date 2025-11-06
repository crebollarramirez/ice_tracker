"use client";

import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

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
    <div className="relative inline-flex items-center bg-muted rounded-full p-0.5 border border-border/50">
      {/* Animated background slider */}
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 rounded-full shadow-sm transition-all duration-300 ease-in-out bg-primary",
          locale === "en" ? "left-0.5 right-[50%]" : "left-[50%] right-0.5"
        )}
      />

      {/* Buttons */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleLanguageChange("en")}
        className={cn(
          "relative z-10 h-9 px-4 font-medium rounded-full transition-colors duration-300",
          locale === "en"
            ? "text-primary-foreground hover:text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Switch to English"
      >
        English
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleLanguageChange("es")}
        className={cn(
          "relative z-10 h-9 px-4 font-medium rounded-full transition-colors duration-300",
          locale === "es"
            ? "text-primary-foreground hover:text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Cambiar a Español"
      >
        Español
      </Button>
    </div>
  );
}
