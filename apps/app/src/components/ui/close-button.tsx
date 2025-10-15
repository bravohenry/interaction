import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface CloseButtonProps {
  onClick: () => void;
  className?: string;
  "aria-label"?: string;
}

export function CloseButton({
  onClick,
  className,
  "aria-label": ariaLabel = "Close",
}: CloseButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "flex items-center justify-center rounded-lg p-1.5 transition-transform active:scale-[0.98] md:hover:bg-gray-50",
        className
      )}
      onClick={onClick}
      type="button"
    >
      <X className="h-5 w-5 text-gray-400" />
    </button>
  );
}
