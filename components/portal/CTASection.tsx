"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import SquiggleUnderline from "../ui/squiggle-underline";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function CTASection() {
  const t = useTranslations("portal");
  const reduce = useReducedMotion();

  const hidden = reduce
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 0, y: 28, filter: "blur(14px)" };
  const shown = { opacity: 1, y: 0, filter: "blur(0px)" };

  return (
    <section className="w-full bg-white py-20 sm:py-28 md:py-36 border-t border-neutral-100 relative z-50 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[520px] rounded-full bg-lime-200/30 blur-[140px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center gap-6 sm:gap-8 relative z-10">
        <motion.h2
          initial={hidden}
          whileInView={shown}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="text-3xl sm:text-4xl md:text-6xl font-semibold text-neutral-900 tracking-[-0.03em] leading-[1.02]"
        >
          {t("ctaSection.titlePrefix")} <br />
          <span className="relative inline-block pb-2">
            <span className="relative z-10 text-neutral-900">
              {t("ctaSection.titleHighlight")}
            </span>
            <SquiggleUnderline
              variant="arrow"
              className="text-lime-500"
              strokeWidth={3.5}
              delay={0.4}
              duration={1.2}
            />
          </span>
        </motion.h2>

        <motion.p
          initial={hidden}
          whileInView={shown}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.12 }}
          className="text-sm sm:text-base md:text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed"
        >
          {t("ctaSection.description")}
        </motion.p>

        <motion.div
          initial={hidden}
          whileInView={shown}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.22 }}
          className="flex gap-4 mt-1 sm:mt-2"
        >
          <Link
            href="/signup"
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-full font-medium text-sm transition-all shadow-[0_18px_36px_-18px_rgba(15,23,42,0.5)] active:scale-[0.98]"
          >
            {t("ctaSection.createPortal")}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
