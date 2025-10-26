"use client";

import { useTranslations } from "next-intl";

export default function Maintenance() {
  const t = useTranslations("maintenance");

  return (
    <div className="flex flex-col p-3 md:p-4 border border-gray-300 rounded-lg bg-white shadow-md text-black min-h-80 md:h-96">
      {/* Header matching AddressForm style */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚙️</span>
        <h3 className="text-base md:text-lg font-semibold text-yellow-600">
          {t("title")}
        </h3>
      </div>

      {/* Main content area - matches AddressForm flex structure */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="flex justify-center mb-4">
          <svg
            className="h-12 w-12 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        <div className="text-center bg-yellow-50 p-3 rounded border border-yellow-200">
          <p className="text-yellow-700 text-sm md:text-base leading-relaxed">
            {t("message")}
          </p>
        </div>
      </div>
    </div>
  );
}
