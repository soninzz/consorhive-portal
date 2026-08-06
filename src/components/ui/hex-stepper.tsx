import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type HexStep = { label: string };

/** Stepper de células hexagonais se preenchendo — narrativa "seu enxame está sendo montado". */
export function HexStepper({ steps, current }: { steps: HexStep[]; current: number }) {
  return (
    <div className="mb-8 flex items-center gap-1.5">
      {steps.map((step, idx) => {
        const num = idx + 1;
        const done = current > num;
        const active = current === num;
        return (
          <div key={step.label} className="flex items-center gap-1.5">
            <div
              className={cn(
                "hex-cell relative flex h-9 w-9 items-center justify-center text-sm font-semibold transition-all duration-300",
                done && "bg-primary text-primary-foreground",
                active && "hex-cell-active bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_0_14px_rgba(var(--glow-gold),0.55)]",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check size={15} /> : num}
            </div>
            {num < steps.length && (
              <div className={cn("h-[2px] w-6 rounded-full transition-colors", done ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
      <span className="ml-3 text-sm text-muted-foreground">{steps[current - 1]?.label}</span>
    </div>
  );
}
