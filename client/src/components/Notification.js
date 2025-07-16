import React, { useState, useEffect } from "react";

export default function Notification({ message, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    // Slide in from the right
    const slideInTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    // Start sliding out after 3 seconds
    const slideOutTimer = setTimeout(() => {
      setIsSliding(true);
      // Call onClose after animation completes
      setTimeout(() => {
        onClose();
      }, 300);
    }, 3000);

    return () => {
      clearTimeout(slideInTimer);
      clearTimeout(slideOutTimer);
    };
  }, [onClose]);

  return (
    <div 
      className={`fixed top-4 md:right-4 md:w-96 bg-red-600 text-white px-3 py-2 md:px-4 md:py-3 rounded shadow-lg z-50 transition-transform duration-300 ease-in-out ${
        isSliding 
          ? 'transform translate-x-full' 
          : isVisible 
            ? 'transform translate-x-0' 
            : 'transform translate-x-full'
      } ${
        // Mobile positioning
        'left-4 right-4 md:left-auto'
      }`}
    >
      <div className="flex items-start justify-center md:justify-start">
        <span className="text-sm md:text-base leading-tight break-words text-center md:text-left">{message}</span>
      </div>
    </div>
  );
}
