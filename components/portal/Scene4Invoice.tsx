"use client";

import { motion, MotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Check, Lock, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../ui/button";
import SquiggleUnderline from "../ui/squiggle-underline";

interface Props {
  progress: MotionValue<number>;
}

export default function Scene4Invoice({ progress }: Props) {
  const t = useTranslations("portal");
  const [showSuccess, setShowSuccess] = useState(false);
  const [amount, setAmount] = useState(0);

  // Scene4: 0.78 → 1.00
  // Entrance blur is gentler than earlier scenes so the amount and copy
  // resolve to readable well before the count-up starts at 0.84. Once the
  // scene is fully visible, we drop the filter entirely (via "none") so it
  // doesn't create a stacking context that muddies the success overlay's
  // backdrop-filter on Safari/Chrome.
  const opacity = useTransform(progress, [0.78, 0.84, 1.0], [0, 1, 1]);
  const blur = useTransform(
    progress,
    [0.78, 0.82, 0.84, 1.0],
    ["blur(8px)", "blur(2px)", "blur(0px)", "blur(0px)"],
  );
  const sceneScale = useTransform(progress, [0.78, 0.86], [0.99, 1]);
  const cardScale = useTransform(progress, [0.80, 0.90], [0.96, 1]);
  const cardY = useTransform(progress, [0.80, 0.90], [40, 0]);
  const textY = useTransform(progress, [0.80, 0.90], [24, 0]);

  useEffect(() => {
    return progress.onChange((latest) => {
      if (latest > 0.84 && latest <= 0.92) {
        setAmount(Math.floor(((latest - 0.84) / 0.08) * 2500));
      } else if (latest > 0.92) {
        setAmount(2500);
      } else if (latest <= 0.84) {
        setAmount(0);
      }
      setShowSuccess(latest > 0.94);
    });
  }, [progress]);

  return (
    <motion.div
      style={{ opacity, filter: blur, scale: sceneScale }}
      className="absolute inset-0 bg-[#FAFAFA] flex items-center justify-center px-4 sm:px-6 md:px-12 z-40 overflow-hidden"
    >
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[720px] h-[520px] bg-lime-100/50 blur-[140px] rounded-full" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center relative z-10">
        {/* Left: Refined Message */}
        <motion.div
          style={{ y: textY }}
          className="lg:col-span-5 space-y-5 sm:space-y-7 text-center lg:text-left order-2 lg:order-1 px-2 sm:px-4 lg:px-0"
        >
          <div className="space-y-4 sm:space-y-6">
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-medium tracking-[0.22em] uppercase text-neutral-500">
              <span className="h-px w-6 sm:w-8 bg-neutral-300" />
              {t("scene4.badge")}
            </span>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-semibold text-neutral-900 tracking-[-0.03em] leading-[1.05]">
              {t("scene4.titlePrefix")} <br className="hidden lg:block" />
              <span className="relative inline-block pb-1.5 text-neutral-900">
                {t("scene4.titleHighlight")}
                <SquiggleUnderline
                  variant="arrow"
                  className="text-lime-500"
                  strokeWidth={3}
                  progress={progress}
                  progressRange={[0.86, 0.94]}
                />
              </span>
            </h2>

            <p className="text-sm sm:text-base lg:text-lg text-neutral-500 leading-relaxed max-w-md mx-auto lg:mx-0">
              {t("scene4.description")}
            </p>
          </div>

          <div className="space-y-4 sm:space-y-5 pt-1 sm:pt-2">
            <div className="divide-y divide-neutral-200/70 border-y border-neutral-200/70">
              {[
                { key: "vault", icon: Lock, label: t("scene4.vaultProtection"), detail: t("scene4.vaultProtectionDetail") },
                { key: "settlement", icon: Zap, label: t("scene4.instantSettlement"), detail: t("scene4.instantSettlementDetail") },
              ].map(({ key, icon: Icon, label, detail }) => (
                <div key={key} className="flex items-center gap-3 sm:gap-4 justify-start py-3 sm:py-3.5 group">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white border border-neutral-200/70 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-[1.04] duration-300">
                    <Icon className="w-4 h-4 text-neutral-700" strokeWidth={1.75} />
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-xs sm:text-sm font-medium text-neutral-900">{label}</span>
                    <span className="text-[10px] sm:text-xs text-neutral-500">{detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center lg:justify-start pt-1">
              <Button>{t("scene4.tryNow")}</Button>
            </div>
          </div>
        </motion.div>

        {/* Right: Tactile Payment Card */}
        <div className="lg:col-span-7 relative order-1 lg:order-2 px-2 sm:px-4 lg:px-0 flex justify-center lg:justify-end">
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-lime-300/25 blur-[120px] rounded-full z-0"
          />

          <motion.div
            style={{ scale: cardScale, y: cardY }}
            className="relative z-10 w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[400px]"
          >
            <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2rem] sm:rounded-[2.5rem] p-1.5 sm:p-2 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] relative overflow-hidden">
              <div className="bg-white rounded-[1.6rem] sm:rounded-[2rem] p-5 sm:p-6 lg:p-8 border border-neutral-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)] relative overflow-hidden">
                {/* Header inside card */}
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-neutral-200 to-neutral-100 border border-neutral-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                      <div className="w-full h-full bg-gradient-to-b from-transparent to-neutral-300/50 translate-y-2 rounded-full" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] sm:text-xs font-bold text-neutral-900 truncate">{t("scene4.customerName")}</span>
                      <span className="text-[9px] sm:text-[10px] font-medium text-neutral-400 truncate">{t("scene4.milestoneLabel")}</span>
                    </div>
                  </div>
                  <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-neutral-100 rounded-full text-[9px] sm:text-[10px] font-semibold text-neutral-500 border border-neutral-200/80 shrink-0">
                    #VR-8829
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1 mb-6 sm:mb-8">
                  <span className="text-xs sm:text-sm font-semibold text-neutral-400 block">{t("scene4.totalDue")}</span>
                  <div className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter text-neutral-900 tabular-nums">
                    ${amount.toLocaleString()}
                    <span className="text-2xl sm:text-3xl text-neutral-300">.00</span>
                  </div>
                </div>

                {/* Button */}
                <button className="w-full relative group overflow-hidden rounded-xl sm:rounded-2xl bg-neutral-900 text-white font-medium py-3.5 sm:py-4 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)] transition-transform active:scale-95 flex items-center justify-center gap-2 text-sm sm:text-base">
                  <Lock className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                  <span>{t("scene4.releaseFunds")}</span>
                </button>

                {/* Success Overlay — solid opaque panel so the message is
                    always crisp, regardless of parent filter stacking context.
                    A subtle inner glow keeps it feeling like a moment, but the
                    text sits on real white rather than translucent bg + blur. */}
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 bg-white"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-lime-50/70 via-white to-white" />
                      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-lime-200/50 blur-3xl" />

                      <motion.div
                        initial={{ scale: 0.5, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-lime-400 to-lime-500 border-[3px] border-white shadow-[0_20px_40px_-10px_rgba(132,204,22,0.5),inset_0_4px_8px_rgba(255,255,255,0.6)] flex items-center justify-center mb-3 sm:mb-4"
                      >
                        <Check className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-md" strokeWidth={3} />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="relative text-center"
                      >
                        <div className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">{t("scene4.paymentReleased")}</div>
                        <div className="text-xs sm:text-sm font-medium text-neutral-600 mt-1">{t("scene4.fundsTransferred")}</div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
