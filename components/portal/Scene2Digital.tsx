"use client";

import {
  motion,
  MotionValue,
  useTransform,
} from "framer-motion";
import {
  CalendarDays,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Home,
  Layout,
  Milestone,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import SquiggleUnderline from "../ui/squiggle-underline";

interface Props {
  progress: MotionValue<number>;
}

function Reveal({
  progress,
  start,
  end,
  distance = 22,
  className,
  children,
}: {
  progress: MotionValue<number>;
  start: number;
  end: number;
  distance?: number;
  className?: string;
  children: ReactNode;
}) {
  const y = useTransform(progress, [start, end], [distance, 0]);
  const opacity = useTransform(progress, [start, end - 0.005], [0, 1]);
  const filter = useTransform(
    progress,
    [start, end],
    ["blur(8px)", "blur(0px)"],
  );
  return (
    <motion.div style={{ y, opacity, filter }} className={className}>
      {children}
    </motion.div>
  );
}

/*
  Chips restrained to the portal's neutral palette so they don't clash with the
  lime + warm-neutral language. The status hue survives only as a small
  indicator dot — the chip body stays quiet.
*/
type StatusKey =
  | "ONBOARDING"
  | "MODELLING"
  | "DEPLOYMENT"
  | "MAINTENANCE"
  | "COMPLETED";

const statusDot: Record<StatusKey, string> = {
  ONBOARDING: "bg-neutral-400",
  MODELLING: "bg-neutral-500",
  DEPLOYMENT: "bg-neutral-700",
  MAINTENANCE: "bg-lime-500",
  COMPLETED: "bg-lime-600",
};

const statusI18nSubkey: Record<StatusKey, string> = {
  ONBOARDING: "statusOnboarding",
  MODELLING: "statusModelling",
  DEPLOYMENT: "statusDeployment",
  MAINTENANCE: "statusMaintenance",
  COMPLETED: "statusCompleted",
};

function StatusBadge({ status }: { status: StatusKey }) {
  const t = useTranslations("portal");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-neutral-50/80 px-2 py-0.5 text-[10px] font-medium tracking-wide text-neutral-600">
      <span className={`size-1.5 rounded-full ${statusDot[status]}`} />
      {t(`scene2.${statusI18nSubkey[status]}`)}
    </span>
  );
}

function MetaTile({ icon: Icon, label }: { icon: typeof CalendarDays; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-2 py-1.5 text-[10px] font-medium text-neutral-600">
      <Icon className="h-3 w-3 text-neutral-500 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function Scene2Digital({ progress }: Props) {
  const t = useTranslations("portal");

  // Scene2: 0.22 → 0.50
  // — blur-in 0.22-0.28, visible 0.28-0.46, blur-out 0.46-0.50
  const opacity = useTransform(
    progress,
    [0.22, 0.28, 0.46, 0.50],
    [0, 1, 1, 0],
  );
  const blur = useTransform(
    progress,
    [0.22, 0.28, 0.46, 0.50],
    ["blur(14px)", "blur(0px)", "blur(0px)", "blur(10px)"],
  );
  const scale = useTransform(progress, [0.22, 0.30], [0.985, 1]);
  const mockupY = useTransform(progress, [0.25, 0.36], [40, 0]);
  const textY = useTransform(progress, [0.24, 0.34], [24, 0]);

  // Progress bars fill live within the visible band.
  const card1ProgressWidth = useTransform(
    progress,
    [0.36, 0.42],
    ["0%", "55%"],
  );
  const card2ProgressWidth = useTransform(
    progress,
    [0.38, 0.44],
    ["0%", "80%"],
  );

  const sidebarNav = [
    { icon: Home, active: false },
    { icon: FolderKanban, active: true },
    { icon: Milestone, active: false },
    { icon: FileText, active: false },
    { icon: Settings, active: false },
  ];

  const filterChips = [
    { key: "all", label: t("scene2.filterAll"), active: true },
    { key: "onboarding", label: t("scene2.filterOnboarding") },
    { key: "modelling", label: t("scene2.filterModelling") },
    { key: "deployment", label: t("scene2.filterDeployment") },
    { key: "completed", label: t("scene2.filterCompleted") },
  ];

  return (
    <motion.div
      style={{ opacity, filter: blur, scale }}
      className="absolute inset-0 bg-[#f7f6f2] flex items-center justify-center px-4 sm:px-6 md:px-12 z-20"
    >
      {/* Ambient light — one, soft, off-center */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[720px] h-[520px] bg-lime-200/40 blur-[140px] rounded-full" />
      </div>

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-16 items-center">
        {/* Left: Message */}
        <motion.div
          style={{ y: textY }}
          className="lg:col-span-5 space-y-4 sm:space-y-6 text-center lg:text-left px-2 sm:px-4 lg:px-0"
        >
          <span className="inline-flex items-center gap-2 text-[10px] sm:text-[11px] font-medium tracking-[0.22em] uppercase text-neutral-500">
            <span className="h-px w-6 sm:w-8 bg-neutral-300" />
            {t("scene2.badge")}
          </span>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-semibold text-neutral-900 tracking-[-0.03em] leading-[1.05]">
            {t("scene2.titlePrefix")}{" "}
            <span className="relative inline-block pb-1.5">
              {t("scene2.titleHighlight")}
              <SquiggleUnderline
                variant="arrow"
                className="text-lime-500"
                strokeWidth={3}
                progress={progress}
                progressRange={[0.30, 0.40]}
              />
            </span>
          </h2>

          <p className="text-sm sm:text-base lg:text-lg text-neutral-500 leading-relaxed max-w-md mx-auto lg:mx-0">
            {t("scene2.description")}
          </p>

          <div className="flex flex-wrap gap-x-5 sm:gap-x-6 gap-y-2 sm:gap-y-3 justify-center lg:justify-start pt-1 sm:pt-2">
            {["secureStorage", "realtimeSync", "easyAccess"].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-lime-500 rounded-full" />
                <span className="text-xs sm:text-sm font-medium text-neutral-700">
                  {t(`scene2.${feature}`)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: App interface mockup */}
        <motion.div
          style={{ y: mockupY }}
          className="lg:col-span-7 relative px-1 sm:px-4 lg:px-0"
        >
          <div className="absolute inset-x-8 -bottom-4 h-24 bg-neutral-900/10 blur-3xl rounded-full" />

          <div className="relative bg-white border border-neutral-200/80 rounded-xl sm:rounded-2xl overflow-hidden max-w-full mx-auto sm:max-w-lg lg:max-w-none shadow-[0_30px_60px_-30px_rgba(15,23,42,0.18)]">
            {/* Browser chrome */}
            <div className="border-b border-neutral-100 bg-neutral-50/60 px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-neutral-200" />
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-neutral-200" />
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-neutral-200" />
              </div>
              <div className="flex-1 min-w-0 mx-2 sm:mx-3 bg-white border border-neutral-100 rounded-md px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] text-neutral-400 truncate font-mono">
                veritas.app/freelancer/projects
              </div>
            </div>

            {/* App content */}
            <div className="flex">
              {/* Sidebar */}
              <div className="w-11 sm:w-14 lg:w-16 border-r border-neutral-100 bg-neutral-50/40 py-3 sm:py-4 flex flex-col items-center gap-1.5 sm:gap-2 shrink-0">
                <Reveal
                  progress={progress}
                  start={0.30}
                  end={0.335}
                  distance={12}
                >
                  <div className="w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 bg-lime-400 rounded-md flex items-center justify-center">
                    <Layout className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-900" />
                  </div>
                </Reveal>
                {sidebarNav.map(({ icon: Icon, active }, i) => (
                  <Reveal
                    key={i}
                    progress={progress}
                    start={0.31 + i * 0.005}
                    end={0.345 + i * 0.005}
                    distance={12}
                  >
                    <div
                      className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-md flex items-center justify-center ${
                        active
                          ? "bg-neutral-100 text-neutral-900"
                          : "border border-neutral-100 bg-white text-neutral-400"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={1.75} />
                    </div>
                  </Reveal>
                ))}
              </div>

              {/* Main area */}
              <div className="flex-1 min-w-0 p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4">
                {/* Toolbar */}
                <Reveal
                  progress={progress}
                  start={0.315}
                  end={0.36}
                  className="flex items-center justify-between gap-2 sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[8px] sm:text-[9px] font-medium tracking-[0.22em] uppercase text-neutral-400">
                      {t("scene2.workspaceLabel")}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-neutral-900 tracking-tight">
                      {t("scene2.projectsTitle")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-neutral-200/70 bg-neutral-50/60 px-2 py-1 text-[10px] text-neutral-400">
                      <Search className="h-3 w-3" strokeWidth={1.75} />
                      {t("scene2.searchLabel")}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] font-medium text-white">
                      <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2} />
                      {t("scene2.newButton")}
                    </div>
                  </div>
                </Reveal>

                {/* Filter chips */}
                <Reveal
                  progress={progress}
                  start={0.33}
                  end={0.37}
                  className="flex flex-wrap items-center gap-1 sm:gap-1.5"
                >
                  {filterChips.map(({ key, label, active }) => (
                    <span
                      key={key}
                      className={`inline-flex items-center rounded-full border px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium ${
                        active
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "border-neutral-200 text-neutral-500 bg-white"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </Reveal>

                {/* Project card 1 — MODELLING */}
                <div className="rounded-lg sm:rounded-xl border border-neutral-200/80 bg-white p-2.5 sm:p-3.5 space-y-2.5 sm:space-y-3">
                  <Reveal
                    progress={progress}
                    start={0.345}
                    end={0.38}
                    className="flex items-start justify-between gap-2 sm:gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[8px] sm:text-[9px] font-medium tracking-[0.22em] uppercase text-neutral-400 mb-0.5 sm:mb-1">
                        {t("scene2.projectEyebrow")}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-neutral-900 tracking-tight truncate">
                        {t("scene2.project1Name")}
                      </div>
                    </div>
                    <StatusBadge status="MODELLING" />
                  </Reveal>

                  <Reveal
                    progress={progress}
                    start={0.355}
                    end={0.39}
                    className="grid grid-cols-3 gap-1 sm:gap-1.5"
                  >
                    <MetaTile icon={CalendarDays} label={t("scene2.project1Date")} />
                    <MetaTile icon={Milestone} label={t("scene2.project1Stages")} />
                    <MetaTile icon={CircleDollarSign} label={t("scene2.project1Invoices")} />
                  </Reveal>

                  <Reveal
                    progress={progress}
                    start={0.365}
                    end={0.4}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-neutral-400 tabular-nums">
                      <span>{t("scene2.progressLabel")}</span>
                      <span>55%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <motion.div
                        style={{ width: card1ProgressWidth }}
                        className="h-full rounded-full bg-neutral-900"
                      />
                    </div>
                  </Reveal>
                </div>

                {/* Project card 2 — DEPLOYMENT */}
                <div className="rounded-lg sm:rounded-xl border border-neutral-200/80 bg-white p-2.5 sm:p-3.5 space-y-2.5 sm:space-y-3">
                  <Reveal
                    progress={progress}
                    start={0.375}
                    end={0.41}
                    className="flex items-start justify-between gap-2 sm:gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[8px] sm:text-[9px] font-medium tracking-[0.22em] uppercase text-neutral-400 mb-0.5 sm:mb-1">
                        {t("scene2.projectEyebrow")}
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-neutral-900 tracking-tight truncate">
                        {t("scene2.project2Name")}
                      </div>
                    </div>
                    <StatusBadge status="DEPLOYMENT" />
                  </Reveal>

                  <Reveal
                    progress={progress}
                    start={0.385}
                    end={0.42}
                    className="grid grid-cols-3 gap-1 sm:gap-1.5"
                  >
                    <MetaTile icon={CalendarDays} label={t("scene2.project2Date")} />
                    <MetaTile icon={Milestone} label={t("scene2.project2Stages")} />
                    <MetaTile icon={CircleDollarSign} label={t("scene2.project2Invoices")} />
                  </Reveal>

                  <Reveal
                    progress={progress}
                    start={0.395}
                    end={0.43}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-neutral-400 tabular-nums">
                      <span>{t("scene2.progressLabel")}</span>
                      <span>80%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
                      <motion.div
                        style={{ width: card2ProgressWidth }}
                        className="h-full rounded-full bg-neutral-900"
                      />
                    </div>
                  </Reveal>
                </div>
              </div>
            </div>
          </div>

          {/* Floating status chip nodes anchored around the mockup — hidden on
              mobile, they orbit the interface as extra "nodes" the user sees. */}
          <div className="hidden lg:block pointer-events-none">
            <Reveal
              progress={progress}
              start={0.40}
              end={0.44}
              distance={16}
              className="absolute -top-3 -left-3"
            >
              <div className="rounded-full border border-neutral-200/80 bg-white/90 backdrop-blur px-2.5 py-1 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.25)]">
                <StatusBadge status="COMPLETED" />
              </div>
            </Reveal>
            <Reveal
              progress={progress}
              start={0.41}
              end={0.45}
              distance={16}
              className="absolute -bottom-3 -right-3"
            >
              <div className="rounded-full border border-neutral-200/80 bg-white/90 backdrop-blur px-2.5 py-1 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.25)]">
                <StatusBadge status="ONBOARDING" />
              </div>
            </Reveal>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
