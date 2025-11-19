import { cn } from "@/utils/utils";

export const StatusBadge = ({
  color = "primary",
  animate = false,
  children,
  className,
}) => {
  const colorVariants = {
    primary: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600",
    warning: "bg-yellow-500/10 text-yellow-600",
    error: "bg-red-500/10 text-red-600",
    info: "bg-blue-500/10 text-blue-600",
    neutral: "bg-gray-500/10 text-gray-600",
  };

  return (
    <span
      className={cn(
        "text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap",
        colorVariants[color] || colorVariants.primary,
        animate && "animate-pulse",
        className
      )}
    >
      {children}
    </span>
  );
};
