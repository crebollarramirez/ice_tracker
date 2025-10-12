import React from "react";
import { DONATE_LINK } from "@/constants";


export const DonateButton = ({
  href = DONATE_LINK,
  children = "Donate",
}) => {
  return (
    <div className="inline-block relative">
      {/* Bottom layer - visible on right and bottom */}
      <div className="absolute top-1 left-1 w-full h-full bg-red-200 rounded-md"></div>

      {/* Top layer - main button */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        role="button"
        aria-label="Donate (opens in a new tab)"
        className="relative inline-flex items-center justify-center px-2 py-1 md:px-4 md:py-2 text-sm md:text-base bg-red-600 text-white/85 rounded-md font-semibold border-2 border-red-700 hover:bg-red-700 hover:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 gap-1 transition-all duration-200 hover:translate-x-0.5 hover:translate-y-0.5"
      >
        {children}
        <svg
          className="w-5 h-5 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </a>
    </div>
  );
};

export default DonateButton;
