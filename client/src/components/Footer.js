import React from "react";
import { Info } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border mt-8 w-full">
      <div className="w-full flex items-center justify-around">
        <div className="container flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-muted-foreground px-4 py-8">
          <div className="flex items-start md:items-center gap-2 ">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 md:mt-0" />
            <p>
              For immediate emergencies, contact local emergency services. For
              immigration legal help, contact qualified legal aid organizations.
            </p>
          </div>
          <a
            href="https://www.aclu.org/know-your-rights/immigrants-rights/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline whitespace-nowrap"
          >
            Know Your Rights →
          </a>
        </div>
      </div>
    </footer>
  );
};
