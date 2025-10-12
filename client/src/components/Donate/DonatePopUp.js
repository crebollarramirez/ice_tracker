import { X, Heart } from "lucide-react";
import { useDonate } from "@/contexts/DonateContext";
import { DONATE_LINK } from "@/constants";

export const DonatePopUp = () => {
  const { isVisible, hideDonatePopup, hideNotice } = useDonate();

  if (!isVisible) return null;

  const handleClose = () => {
    hideDonatePopup();
    hideNotice();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Semi-transparent overlay with blur */}
      <div
        className="absolute inset-0 backdrop-blur-md bg-black/25"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Popup content */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl transform transition-all duration-300 scale-100">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Icon/Header */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
              <Heart
                className="w-8 h-8 text-white"
                style={{ fill: "currentColor" }}
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-3">
            Support Our Mission
          </h2>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-gray-600 text-center mb-6">
            Help us keep this vital safety resource free and accessible
          </p>

          {/* Description */}
          <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 mb-6">
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              Every donation helps us cover the costs of verifying location
              accuracy, maintaining our servers, and using essential online
              tools that power the site. Your contribution keeps the platform
              online, reliable, and accessible—so communities can stay informed
              and safe.
            </p>
          </div>

          {/* Impact stats (optional decorative element) */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">100%</div>
              <div className="text-xs text-gray-600">Free Access</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">24/7</div>
              <div className="text-xs text-gray-600">Monitoring</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Donate Now Button with layered effect */}
            <div className="flex-1 relative inline-block">
              {/* Bottom layer */}
              <div className="absolute top-1 left-1 w-full h-full bg-red-200 rounded-xl"></div>
              {/* Top layer */}
              <a
                href={DONATE_LINK}
                target="_blank"
                rel="noopener noreferrer"
                role="button"
                aria-label="Donate (opens in a new tab)"
                className="relative w-full inline-flex items-center justify-center px-4 py-4 bg-red-600 text-white rounded-xl font-semibold border-2 border-red-700 hover:bg-red-700 hover:border-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 gap-2 transition-all duration-200 hover:translate-x-0.5 hover:translate-y-0.5 shadow-lg hover:shadow-xl cursor-pointer"
              >
                <Heart className="w-5 h-5" />
                Donate Now
              </a>
            </div>

            {/* Maybe Later Button with layered effect */}
            <div className="flex-1 relative inline-block">
              {/* Bottom layer */}
              <div className="absolute top-1 left-1 w-full h-full bg-gray-300 rounded-xl"></div>
              {/* Top layer */}
              <button
                onClick={handleClose}
                className="relative w-full inline-flex items-center justify-center px-4 py-4 bg-white text-gray-700 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-200 hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </div>

          {/* Small note */}
          <p className="text-xs text-center text-gray-500 mt-4">
            We&apos;re a community-driven initiative. Thank you for your
            consideration.
          </p>
        </div>
      </div>
    </div>
  );
};
