"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Clock,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const POPOVER_ESTIMATED_HEIGHT = 220;
const POPOVER_MARGIN = 24;

type Placement = "top" | "bottom";

interface Problem {
  key: string;
  icon: LucideIcon;
  title: string;
  description: string;
  fix: {
    icon: LucideIcon;
    title: string;
    description: string;
  };
}

function MagicFixPopover({
  open,
  fix,
  placement,
  brandLabel,
}: {
  open: boolean;
  fix: Problem["fix"];
  placement: Placement;
  brandLabel: string;
}) {
  const reduce = useReducedMotion();
  const Icon = fix.icon;
  // Direction-aware enter/exit — the card slides from the trigger toward its
  // resting position, so an above-placement rises up and a below-placement
  // drops down. Feels grounded rather than teleported.
  const enterOffset = placement === "top" ? -8 : 8;
  const exitOffset = placement === "top" ? -6 : 6;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: enterOffset, filter: "blur(10px)", scale: 0.96 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: exitOffset, filter: "blur(8px)", scale: 0.97 }}
          transition={{ duration: 0.36, ease: EASE }}
          className={`pointer-events-none absolute left-0 right-0 z-30 ${
            placement === "top" ? "bottom-full mb-3" : "top-full mt-3"
          }`}
        >
          <div className="pointer-events-auto relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-lime-300/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200/70 bg-white/95 p-4 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-lime-200/60 blur-2xl" />
              <div className="relative flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-lime-300 shadow-sm">
                  <Icon className="size-4" strokeWidth={2} />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-lime-700">
                    {brandLabel}
                  </div>
                  <div className="text-sm font-semibold tracking-tight text-neutral-900">
                    {fix.title}
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    {fix.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ProblemCard({ problem, index }: { problem: Problem; index: number }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>("bottom");
  const anchorRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("portal");
  const reduce = useReducedMotion();
  const Icon = problem.icon;

  const hidden = reduce
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 0, y: 32, filter: "blur(14px)" };
  const shown = { opacity: 1, y: 0, filter: "blur(0px)" };

  const computePlacement = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    // Prefer bottom when the popover comfortably fits there; otherwise flip
    // upward if that has more room. If both are cramped, keep the previous
    // choice — this avoids thrashing near equal-space thresholds.
    if (spaceBelow >= POPOVER_ESTIMATED_HEIGHT + POPOVER_MARGIN) {
      setPlacement("bottom");
    } else if (spaceAbove >= POPOVER_ESTIMATED_HEIGHT + POPOVER_MARGIN) {
      setPlacement("top");
    } else if (spaceAbove > spaceBelow) {
      setPlacement("top");
    } else {
      setPlacement("bottom");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    computePlacement();
    const handle = () => computePlacement();
    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [open, computePlacement]);

  const handleOpen = () => {
    computePlacement();
    setOpen(true);
  };

  return (
    <motion.div
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.08 + index * 0.08 }}
      className="relative flex flex-col gap-4 md:px-8 first:md:pl-0 last:md:pr-0"
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-neutral-200/80 bg-white">
        <Icon className="size-4 text-neutral-700" strokeWidth={1.75} />
      </div>
      <h3 className="text-lg sm:text-xl font-medium text-neutral-900 tracking-tight leading-snug">
        {problem.title}
      </h3>
      <p className="text-sm text-neutral-500 leading-relaxed max-w-sm">
        {problem.description}
      </p>

      <div
        ref={anchorRef}
        className="relative mt-1"
        onMouseEnter={handleOpen}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              handleOpen();
            }
          }}
          onFocus={handleOpen}
          onBlur={() => setOpen(false)}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 transition-colors"
        >
          <span className="relative">
            {t("problem.fixLabel")}
            <span
              aria-hidden
              className={`absolute -bottom-0.5 left-0 h-px w-full origin-left bg-neutral-900 transition-transform duration-300 ease-out ${
                open ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
              }`}
            />
          </span>
          <ArrowUpRight
            className={`size-3.5 transition-transform duration-300 ${
              open ? "-translate-y-0.5 translate-x-0.5" : ""
            }`}
            strokeWidth={2}
          />
        </button>

        <MagicFixPopover
          open={open}
          fix={problem.fix}
          placement={placement}
          brandLabel={t("problem.brand")}
        />
      </div>
    </motion.div>
  );
}

export default function ProblemSection() {
  const t = useTranslations("portal");
  const reduce = useReducedMotion();

  const problems: Problem[] = [
    {
      key: "vague",
      icon: AlertCircle,
      title: t("problem.vagueTitle"),
      description: t("problem.vagueDesc"),
      fix: {
        icon: FileCheck2,
        title: t("problem.vagueFixTitle"),
        description: t("problem.vagueFixDesc"),
      },
    },
    {
      key: "delayed",
      icon: Clock,
      title: t("problem.delayedTitle"),
      description: t("problem.delayedDesc"),
      fix: {
        icon: Zap,
        title: t("problem.delayedFixTitle"),
        description: t("problem.delayedFixDesc"),
      },
    },
    {
      key: "escrow",
      icon: ShieldAlert,
      title: t("problem.escrowTitle"),
      description: t("problem.escrowDesc"),
      fix: {
        icon: ShieldCheck,
        title: t("problem.escrowFixTitle"),
        description: t("problem.escrowFixDesc"),
      },
    },
  ];

  const hidden = reduce
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 0, y: 32, filter: "blur(14px)" };
  const shown = { opacity: 1, y: 0, filter: "blur(0px)" };

  return (
    <section className="w-full bg-[#fbfaf7] py-20 sm:py-28 md:py-32 border-t border-neutral-100 relative z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={hidden}
          whileInView={shown}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="max-w-3xl mb-14 sm:mb-20"
        >
          <h2 className="text-2xl sm:text-3xl md:text-5xl lg:text-[3.4rem] font-semibold text-neutral-900 tracking-[-0.03em] leading-[1.05]">
            {t("problem.heading")}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10 md:gap-y-0 md:divide-x divide-neutral-200/70">
          {problems.map((problem, i) => (
            <ProblemCard key={problem.key} problem={problem} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
