export default function HamburgerButton({
  isOpen,
  onClick,
  className = "",
  ariaLabel = "Toggle menu",
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col justify-center items-center w-8 h-8 ${className}`}
      aria-label={ariaLabel}
    >
      <span
        className={`absolute block w-6 h-0.5 bg-gray-400 transition-all duration-300 ${
          isOpen ? "rotate-45" : "-translate-y-1.5"
        }`}
      ></span>
      <span
        className={`absolute block w-6 h-0.5 bg-gray-400 transition-opacity duration-300 ${
          isOpen ? "opacity-0" : "opacity-100"
        }`}
      ></span>
      <span
        className={`absolute block w-6 h-0.5 bg-gray-400 transition-all duration-300 ${
          isOpen ? "-rotate-45" : "translate-y-1.5"
        }`}
      ></span>
    </button>
  );
}
