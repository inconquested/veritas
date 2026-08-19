"use client";

import { motion, MotionValue, useTransform } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import SquiggleUnderline from "../ui/squiggle-underline";

interface Props {
  progress: MotionValue<number>;
}

export default function Scene3Dashboard({ progress }: Props) {
  const t = useTranslations("portal");
  // Scene3: 0.52 → 0.76
  const opacity = useTransform(progress, [0.52, 0.58, 0.72, 0.76], [0, 1, 1, 0]);
  const blur = useTransform(
    progress,
    [0.52, 0.58, 0.72, 0.76],
    ["blur(14px)", "blur(0px)", "blur(0px)", "blur(10px)"],
  );
  const scale = useTransform(progress, [0.52, 0.60], [0.985, 1]);
  const pathHeight = useTransform(progress, [0.60, 0.70], ["0%", "100%"]);
  const cardY = useTransform(progress, [0.54, 0.64], [30, 0]);
  const textY = useTransform(progress, [0.54, 0.64], [24, 0]);

  return (
    <motion.div
      style={{ opacity, filter: blur, scale }}
      className="absolute inset-0 bg-[#f6f7f9] flex items-center justify-center px-4 sm:px-6 md:px-12 z-30"
    >
      {/* Ambient light */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-1/4 w-[720px] h-[520px] bg-neutral-300/40 blur-[140px] rounded-full" />
      </div>

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 items-center">
        {/* Left: Message */}
        <motion.div
          style={{ y: textY }}
          className="lg:col-span-5 space-y-4 sm:space-y-6 text-center lg:text-left px-2 sm:px-4 lg:px-0"
        >
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-medium tracking-[0.22em] uppercase text-neutral-500">
            <span className="h-px w-6 sm:w-8 bg-neutral-300" />
            {t("scene3.badge")}
          </span>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-semibold text-neutral-900 tracking-[-0.03em] leading-[1.05]">
            {t("scene3.titlePrefix")}{" "}
            <span className="relative inline-block pb-1.5">
              {t("scene3.titleHighlight")}
              <SquiggleUnderline
                variant="arrow"
                className="text-lime-500"
                strokeWidth={3}
                progress={progress}
                progressRange={[0.60, 0.70]}
              />
            </span>
          </h2>

          <p className="text-sm sm:text-base lg:text-lg text-neutral-500 leading-relaxed max-w-md mx-auto lg:mx-0">
            {t("scene3.description")}
          </p>

          <div className="pt-1 sm:pt-2 divide-y divide-neutral-200/70 border-y border-neutral-200/70">
            {[
              { key: "visualTimeline", label: t("scene3.visualTimeline"), status: t("scene3.visualTimelineStatus") },
              { key: "fileManagement", label: t("scene3.fileManagement"), status: t("scene3.fileManagementStatus") },
              { key: "statusTracking", label: t("scene3.statusTracking"), status: t("scene3.statusTrackingStatus") },
            ].map(({ key, label, status }) => (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5 sm:py-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-600 shrink-0" strokeWidth={1.75} />
                  <span className="text-xs sm:text-sm lg:text-base font-medium text-neutral-900 truncate">{label}</span>
                </div>
                <span className="text-[10px] sm:text-xs lg:text-sm text-neutral-500 tabular-nums shrink-0">{status}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: Decorative Dashboard */}
        <motion.div style={{ y: cardY }} className="lg:col-span-7 relative px-1 sm:px-4 lg:px-0">
          <div className="absolute inset-x-8 -bottom-4 h-24 bg-neutral-900/10 blur-3xl rounded-full" />

          <div className="relative bg-white border border-neutral-200/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 max-w-full sm:max-w-lg mx-auto lg:max-w-none shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18)]">
            <div className="relative space-y-4 sm:space-y-6">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] sm:text-[10px] font-medium tracking-[0.22em] uppercase text-neutral-400 mb-0.5 sm:mb-1">
                    {t("scene3.recentFiles")}
                  </div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-neutral-900 tracking-tight">
                    {t("scene3.projectTimeline")}
                  </h3>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-lime-50 border border-lime-200 rounded-full text-[9px] sm:text-[10px] font-medium text-lime-700 shrink-0">
                  <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-lime-500" />
                  {t("scene3.onTrack")}
                </div>
              </div>

              {/* Timeline */}
              <div className="relative pl-7 sm:pl-8">
                <div className="absolute left-2 sm:left-2.5 top-2 bottom-2 w-px bg-neutral-200" />
                <motion.div
                  className="absolute left-2 sm:left-2.5 top-2 w-px bg-neutral-900 origin-top"
                  style={{ height: pathHeight }}
                />

                <div className="space-y-4 sm:space-y-5">
                  {[
                    { key: "scoping", title: t("scene3.projectScoping"), status: t("scene3.statusComplete"), icon: CheckCircle2, color: "text-neutral-900", done: true },
                    { key: "development", title: t("scene3.developmentPhase"), status: t("scene3.statusComplete"), icon: CheckCircle2, color: "text-neutral-900", done: true },
                    { key: "delivery", title: t("scene3.finalDelivery"), status: t("scene3.statusPending"), icon: Circle, color: "text-neutral-300", done: false },
                  ].map(({ key, title, status, icon: Icon, color }) => (
                    <div key={key} className="flex items-start gap-2.5 sm:gap-3 relative">
                      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color} relative z-10 bg-white shrink-0`} strokeWidth={1.75} />
                      <div className="flex-1 flex items-baseline justify-between gap-2 sm:gap-3 min-w-0">
                        <div className="text-xs sm:text-sm lg:text-base font-medium text-neutral-900 truncate">{title}</div>
                        <div className="text-[10px] sm:text-xs text-neutral-500 shrink-0">{status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Files preview */}
              <div className="pt-3 sm:pt-4 border-t border-neutral-100">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[t("scene3.file1"), t("scene3.file2")].map((file) => (
                    <div key={file} className="border border-neutral-100 rounded-lg sm:rounded-xl p-2.5 sm:p-3 bg-white/60 hover:border-neutral-300 transition-colors">
                      <div className="text-xs sm:text-sm font-medium text-neutral-900 truncate">{file}</div>
                      <div className="text-[10px] sm:text-[11px] text-neutral-500 mt-0.5">{t("scene3.daysAgo")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
