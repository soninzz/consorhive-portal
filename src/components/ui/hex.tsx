import * as React from "react";
import { cn } from "@/lib/utils";

/** Container hexagonal pra ícones/avatares — substitui o círculo/quadrado padrão. */
function HexIcon({
  className,
  children,
  size = "default",
  ...props
}: React.ComponentProps<"span"> & { size?: "sm" | "default" | "lg" }) {
  const sizes = {
    sm: "h-7 w-7",
    default: "h-9 w-9",
    lg: "h-12 w-12",
  };
  return (
    <span
      data-slot="hex-icon"
      className={cn(
        "hex-icon relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-primary/25 to-primary/5",
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Badge hexagonal — substitui o chip/pill arredondado padrão pra status e temperatura. */
function HexBadge({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="hex-badge"
      className={cn(
        "hex-badge inline-flex items-center gap-1 px-3.5 py-1 text-xs font-medium capitalize",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Indicador de status em ponto hexagonal — substitui o dot circular padrão. */
function HexDot({
  className,
  pulse = false,
  ...props
}: React.ComponentProps<"span"> & { pulse?: boolean }) {
  return (
    <span
      data-slot="hex-dot"
      className={cn(
        "hex-cell inline-block h-2.5 w-2.5 shrink-0",
        pulse && "hex-cell-active",
        className
      )}
      {...props}
    />
  );
}

export { HexIcon, HexBadge, HexDot };
