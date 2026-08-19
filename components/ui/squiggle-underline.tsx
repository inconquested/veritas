"use client";

import { motion, MotionValue, useReducedMotion, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "wavy" | "bouncy" | "smooth" | "arrow";

interface SquiggleUnderlineProps {
  className?: string;
  strokeWidth?: number;
  variant?: Variant;
  color?: string;
  animate?: boolean;
  delay?: number;
  duration?: number;
  once?: boolean;
  /** When provided, draws pathLength from `progressRange[0]` → `progressRange[1]` of this MotionValue instead of on-view. */
  progress?: MotionValue<number>;
  progressRange?: [number, number];
}

/*
  Paths mirror the hand-drawn language of `squiggle-arrow.tsx` — same Q/T
  curve grammar so the underline reads as the same pen. Every variant sits
  inside `viewBox="0 0 200 40"` so the drawing stays generous when stretched
  to match the underlying text width. All strokes are `pathLength`-drawable
  from a single origin so the on-view + scroll draw animations stay identical.
*/
const bodies: Record<Variant, string> = {
  // Base "wavy": three low humps, matches SquigglyArrow.wavy grammar
  wavy: "M 10 22 Q 40 8, 70 22 T 130 22 T 190 22",
  // Higher amplitude bounce for emphasis
  bouncy: "M 10 22 Q 40 4, 70 22 Q 100 40, 130 22 Q 160 4, 190 22",
  // A gentle single-curve underline
  smooth: "M 10 24 Q 60 12, 100 20 Q 140 28, 190 22",
  // Wavy body with a subtle drift, meant to be followed by an arrowhead
  arrow: "M 10 22 Q 40 8, 70 22 T 130 22 Q 165 20, 188 22",
};

// Arrowhead is drawn only for the `arrow` variant; two short strokes shaped
// like a right-facing chevron so it feels like a natural pen flick at the end.
const arrowHead = "M 188 22 Q 180 18, 176 15 M 188 22 Q 181 26, 177 29";

function ScrollDrawPath({
  d,
  strokeWidth,
  progress,
  range,
}: {
  d: string;
  strokeWidth: number;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const pathLength = useTransform(progress, range, [0, 1]);
  const opacity = useTransform(progress, [range[0], range[0] + 0.005], [0, 1]);
  return (
    <motion.path
      d={d}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      vectorEffect="non-scaling-stroke"
      style={{ pathLength, opacity }}
    />
  );
}

export default function SquiggleUnderline({
  className,
  strokeWidth = 2.5,
  variant = "wavy",
  color = "currentColor",
  animate = true,
  delay = 0,
  duration = 0.9,
  once = true,
  progress,
  progressRange = [0, 1],
}: SquiggleUnderlineProps) {
  const reduce = useReducedMotion();
  const shouldAnimate = animate && !reduce;
  const body = bodies[variant];
  const hasArrow = variant === "arrow";
  // Arrow-head animates AFTER the body finishes drawing (last 15% of range).
  const headStart = progressRange[0] + (progressRange[1] - progressRange[0]) * 0.85;
  const arrowRange: [number, number] = [headStart, progressRange[1]];

  return (
    <svg
      aria-hidden
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
      fill="none"
      className={cn(
        // Sits under the baseline; overflow-visible so bouncy peaks stay crisp
        "pointer-events-none absolute inset-x-0 -bottom-[0.14em] h-[0.36em] w-full overflow-visible",
        className
      )}
      style={{ color }}
    >
      {progress ? (
        <>
          <ScrollDrawPath
            d={body}
            strokeWidth={strokeWidth}
            progress={progress}
            range={progressRange}
          />
          {hasArrow ? (
            <ScrollDrawPath
              d={arrowHead}
              strokeWidth={strokeWidth}
              progress={progress}
              range={arrowRange}
            />
          ) : null}
        </>
      ) : (
        <>
          <motion.path
            d={body}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
            {...(once
              ? {
                  whileInView: { pathLength: 1, opacity: 1 },
                  viewport: { once: true, amount: 0.6 },
                }
              : { animate: { pathLength: 1, opacity: 1 } })}
            transition={{
              pathLength: { duration, ease: [0.22, 1, 0.36, 1], delay },
              opacity: { duration: 0.25, delay },
            }}
          />
          {hasArrow ? (
            <motion.path
              d={arrowHead}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : { pathLength: 1, opacity: 1 }}
              {...(once
                ? {
                    whileInView: { pathLength: 1, opacity: 1 },
                    viewport: { once: true, amount: 0.6 },
                  }
                : { animate: { pathLength: 1, opacity: 1 } })}
              transition={{
                pathLength: { duration: duration * 0.4, ease: [0.22, 1, 0.36, 1], delay: delay + duration * 0.75 },
                opacity: { duration: 0.2, delay: delay + duration * 0.75 },
              }}
            />
          ) : null}
        </>
      )}
    </svg>
  );
}
