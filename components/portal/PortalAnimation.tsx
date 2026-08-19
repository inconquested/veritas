"use client";

import { useEffect, useRef } from "react";
import { useScroll, motion, useTransform, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import Lenis from "lenis";
import Scene1Chaos from "./Scene1Chaos";
import Scene2Digital from "./Scene2Digital";
import Scene3Dashboard from "./Scene3Dashboard";
import Scene4Invoice from "./Scene4Invoice";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ProblemSection from "./ProblemSection";
import CTASection from "./CTASection";
import SquiggleUnderline from "../ui/squiggle-underline";

const EASE = [0.22, 1, 0.36, 1] as const;

/*
  Retimed scroll windows — each scene fully resolves its exit blur before the
  next scene's entrance blur begins, and every internal reveal completes
  inside the "visible" band (never bleeding into the exit):

  Hero mount reveals: 0.10s / 0.22s / 0.34s
  Hero scroll exit:   0.00 → 0.20

  Scene1 exit:        0.00 → 0.20 (y + opacity + blur added for consistency)

  Scene2 blur-in:     0.22 → 0.28
  Scene2 visible:     0.28 → 0.46 (all internal reveals live in [0.30, 0.44])
  Scene2 blur-out:    0.46 → 0.50

  Scene3 blur-in:     0.52 → 0.58
  Scene3 visible:     0.58 → 0.72 (internal reveals live in [0.58, 0.70])
  Scene3 blur-out:    0.72 → 0.76

  Scene4 blur-in:     0.78 → 0.84
  Scene4 visible:     0.84 → 1.00 (amount count 0.84-0.92, success at 0.94+)
*/

export default function PortalAnimation() {
  const t = useTranslations("portal");
  const container = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.1,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: container,
    offset: ["start start", "end end"],
  });

  const heroY = useTransform(scrollYProgress, [0, 0.20], ["0%", "-60%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.16], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.20], [1, 0.96]);
  const heroBlur = useTransform(scrollYProgress, [0, 0.18], ["blur(0px)", "blur(8px)"]);

  const initialHidden = reduce
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 0, y: 24, filter: "blur(14px)" };
  const initialShown = { opacity: 1, y: 0, filter: "blur(0px)" };

  return (
    <div className="w-full bg-white flex flex-col min-h-screen">
      <Navbar />

      {/* Main sticky animation container */}
      <div ref={container} className="relative h-[400vh] w-full bg-white">
        <div className="sticky top-0 left-0 h-[100dvh] w-full overflow-hidden">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity, scale: heroScale, filter: heroBlur }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-40 pointer-events-none"
          >
            <div className="max-w-4xl flex flex-col gap-6 sm:gap-7 items-center">
              <motion.h1
                initial={initialHidden}
                animate={initialShown}
                transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
                className="text-4xl sm:text-5xl md:text-7xl font-semibold text-neutral-900 tracking-[-0.03em] leading-[1.05]"
              >
                {t("hero.titlePrefix")}
                <br className="hidden sm:block" />{" "}
                <span className="relative inline-block pb-2">
                  <span className="relative z-10 text-neutral-900">
                    {t("hero.titleHighlight")}
                  </span>
                  <SquiggleUnderline
                    variant="arrow"
                    className="text-lime-500"
                    strokeWidth={3}
                    delay={0.7}
                    duration={1.1}
                    once={false}
                  />
                </span>
              </motion.h1>

              <motion.p
                initial={initialHidden}
                animate={initialShown}
                transition={{ duration: 0.9, ease: EASE, delay: 0.22 }}
                className="text-sm sm:text-base md:text-lg text-neutral-500 max-w-xl mx-auto leading-relaxed px-2"
              >
                {t("hero.subtitle")}
              </motion.p>

              <motion.div
                initial={initialHidden}
                animate={initialShown}
                transition={{ duration: 0.9, ease: EASE, delay: 0.34 }}
                className="mt-2 h-px w-24 bg-gradient-to-r from-transparent via-neutral-300 to-transparent"
              />
            </div>
          </motion.div>

          <Scene1Chaos progress={scrollYProgress} />
          <Scene2Digital progress={scrollYProgress} />
          <Scene3Dashboard progress={scrollYProgress} />
          <Scene4Invoice progress={scrollYProgress} />
        </div>
      </div>

      <div className="relative bg-white z-50">
        <ProblemSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
