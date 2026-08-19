"use client"

import { FeatureCarousel } from "@/components/ui/feature-carousel"
import {
  ExpandableScreen,
  ExpandableScreenTrigger,
  ExpandableScreenContent,
} from "@/components/ui/expandable-screen"
import { motion } from "motion/react"
import { ArrowRight, Zap, Shield, Layers, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

const carouselImages = {
  step1light1: "https://placehold.co/800x600/1e293b/e2e8f0?text=Dashboard+View",
  step1light2: "https://placehold.co/900x700/334155/f1f5f9?text=Analytics+Panel",
  step2light1: "https://placehold.co/800x600/0f172a/cbd5e1?text=Data+Visualization",
  step2light2: "https://placehold.co/700x500/1e3a8a/dbeafe?text=Real-time+Stats",
  step3light: "https://placehold.co/1200x800/0c4a6e/e0f2fe?text=Integration+Hub",
  step4light: "https://placehold.co/1200x800/1e40af/dbeafe?text=Complete+Platform",
}

const featureDefs = [
  {
    key: "fast",
    icon: Zap,
    color: "from-yellow-500 to-orange-500",
    metrics: [
      { key: "pageLoad", value: "< 1s" },
      { key: "tti", value: "< 2s" },
      { key: "lighthouse", value: "100" },
    ],
  },
  {
    key: "security",
    icon: Shield,
    color: "from-blue-500 to-cyan-500",
    metrics: [
      { key: "uptime", value: "99.99%" },
      { key: "certifications", value: "SOC 2, ISO 27001" },
      { key: "dataCenters", value: "12 Global" },
    ],
  },
  {
    key: "integration",
    icon: Layers,
    color: "from-purple-500 to-pink-500",
    metrics: [
      { key: "apiCalls", value: "10,000+" },
      { key: "integrations", value: "100+" },
      { key: "webhooks", value: "Real-time" },
    ],
  },
  {
    key: "ai",
    icon: Sparkles,
    color: "from-emerald-500 to-teal-500",
    metrics: [
      { key: "timeSaved", value: "40%" },
      { key: "accuracy", value: "98%" },
      { key: "models", value: "Custom" },
    ],
  },
]

function ExpandableFeatureCard({ def, index }: { def: typeof featureDefs[0]; index: number }) {
  const t = useTranslations("landing")
  const Icon = def.icon

  return (
    <ExpandableScreen layoutId={`feature-${index}`}>
      <ExpandableScreenTrigger>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
          className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${def.color} opacity-0 transition-opacity group-hover:opacity-5`}
          />
          <div className="relative">
            <div
              className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${def.color} p-3`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {t(`features.${def.key}.title`)}
            </h3>
            <p className="mb-4 text-neutral-600 dark:text-neutral-400">
              {t(`features.${def.key}.description`)}
            </p>
            <div className="flex items-center text-sm font-medium text-neutral-900 group-hover:text-blue-600 dark:text-neutral-100 dark:group-hover:text-blue-400">
              {t("features.learnMore")}
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </motion.div>
      </ExpandableScreenTrigger>

      <ExpandableScreenContent className="bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
        <div className="mx-auto max-w-4xl p-8 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={`mb-6 inline-flex rounded-2xl bg-gradient-to-br ${def.color} p-4`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="mb-4 text-4xl font-bold text-neutral-900 dark:text-neutral-100">
              {t(`features.${def.key}.headline`)}
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
              {t(`features.${def.key}.content`)}
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              {def.metrics.map((metric, idx) => (
                <motion.div
                  key={metric.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="rounded-xl bg-white/50 p-6 backdrop-blur-sm dark:bg-neutral-800/50"
                >
                  <div className={`mb-2 text-3xl font-bold bg-gradient-to-br ${def.color} bg-clip-text text-transparent`}>
                    {metric.value}
                  </div>
                  <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {t(`features.${def.key}.metrics.${metric.key}`)}
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 rounded-xl bg-white/70 p-8 backdrop-blur-sm dark:bg-neutral-800/70"
            >
              <h3 className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {t("features.ctaHeadline")}
              </h3>
              <p className="mb-6 text-neutral-700 dark:text-neutral-300">
                {t("features.ctaText")}
              </p>
              <button
                className={`rounded-lg bg-gradient-to-r ${def.color} px-6 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105`}
              >
                {t("features.startFreeTrial")}
              </button>
            </motion.div>
          </motion.div>
        </div>
      </ExpandableScreenContent>
    </ExpandableScreen>
  )
}

export default function LandingPage() {
  const t = useTranslations("landing")

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Hero Section with Feature Carousel */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-950" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-neutral-900 sm:text-6xl lg:text-7xl dark:text-neutral-100">
              {t("hero.titlePrefix")}{" "}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t("hero.titleHighlight")}
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
              {t("hero.subtitle")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <FeatureCarousel
              title={t("hero.carouselTitle")}
              description={t("hero.carouselDescription")}
              image={{ ...carouselImages, alt: t("hero.carouselAlt") }}
            />
          </motion.div>
        </div>
      </section>

      {/* Features Grid with Expandable Cards */}
      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="mb-4 text-4xl font-bold text-neutral-900 dark:text-neutral-100">
              {t("features.sectionTitle")}
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
              {t("features.sectionSubtitle")}
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featureDefs.map((def, index) => (
              <ExpandableFeatureCard key={def.key} def={def} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 p-12 shadow-2xl"
          >
            <h2 className="mb-4 text-4xl font-bold text-white">{t("cta.title")}</h2>
            <p className="mb-8 text-xl text-blue-100">
              {t("cta.subtitle")}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <button className="rounded-lg bg-white px-8 py-4 font-semibold text-blue-600 shadow-lg transition-transform hover:scale-105">
                {t("features.startFreeTrial")}
              </button>
              <button className="rounded-lg border-2 border-white px-8 py-4 font-semibold text-white transition-all hover:bg-white/10">
                {t("cta.scheduleDemo")}
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
