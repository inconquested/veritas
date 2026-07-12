"use client"

import { FeatureCarousel } from "@/components/ui/feature-carousel"
import {
  ExpandableScreen,
  ExpandableScreenTrigger,
  ExpandableScreenContent,
} from "@/components/ui/expandable-screen"
import { motion } from "motion/react"
import { ArrowRight, Zap, Shield, Layers, Sparkles } from "lucide-react"

const carouselImages = {
  step1light1: "https://placehold.co/800x600/1e293b/e2e8f0?text=Dashboard+View",
  step1light2: "https://placehold.co/900x700/334155/f1f5f9?text=Analytics+Panel",
  step2light1: "https://placehold.co/800x600/0f172a/cbd5e1?text=Data+Visualization",
  step2light2: "https://placehold.co/700x500/1e3a8a/dbeafe?text=Real-time+Stats",
  step3light: "https://placehold.co/1200x800/0c4a6e/e0f2fe?text=Integration+Hub",
  step4light: "https://placehold.co/1200x800/1e40af/dbeafe?text=Complete+Platform",
  alt: "Feature showcase",
}

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built for speed with optimized performance",
    color: "from-yellow-500 to-orange-500",
    details: {
      headline: "Blazing Performance",
      content:
        "Our platform is engineered from the ground up for speed. With edge-optimized CDN delivery, intelligent caching, and minimal JavaScript footprint, your users get instant load times regardless of their location or device.",
      metrics: [
        { label: "Page Load", value: "< 1s" },
        { label: "Time to Interactive", value: "< 2s" },
        { label: "Lighthouse Score", value: "100" },
      ],
    },
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level encryption and compliance",
    color: "from-blue-500 to-cyan-500",
    details: {
      headline: "Security First",
      content:
        "Your data is protected with enterprise-grade security measures. We employ end-to-end encryption, regular security audits, SOC 2 Type II compliance, and follow industry best practices to keep your information safe.",
      metrics: [
        { label: "Uptime SLA", value: "99.99%" },
        { label: "Certifications", value: "SOC 2, ISO 27001" },
        { label: "Data Centers", value: "12 Global" },
      ],
    },
  },
  {
    icon: Layers,
    title: "Seamless Integration",
    description: "Connect with your existing tools",
    color: "from-purple-500 to-pink-500",
    details: {
      headline: "Built to Integrate",
      content:
        "Integrate with over 100+ tools and services. Our REST API, webhooks, and pre-built connectors make it easy to fit into your existing workflow without disrupting your team's productivity.",
      metrics: [
        { label: "API Calls/min", value: "10,000+" },
        { label: "Integrations", value: "100+" },
        { label: "Webhook Events", value: "Real-time" },
      ],
    },
  },
  {
    icon: Sparkles,
    title: "AI-Powered",
    description: "Smart automation that learns from you",
    color: "from-emerald-500 to-teal-500",
    details: {
      headline: "Intelligence Built In",
      content:
        "Leverage machine learning to automate repetitive tasks, predict user behavior, and optimize your workflows. Our AI adapts to your usage patterns and gets smarter over time.",
      metrics: [
        { label: "Time Saved", value: "40%" },
        { label: "Accuracy", value: "98%" },
        { label: "Learning Models", value: "Custom" },
      ],
    },
  },
]

function ExpandableFeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const Icon = feature.icon

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
            className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 transition-opacity group-hover:opacity-5`}
          />
          <div className="relative">
            <div
              className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${feature.color} p-3`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {feature.title}
            </h3>
            <p className="mb-4 text-neutral-600 dark:text-neutral-400">
              {feature.description}
            </p>
            <div className="flex items-center text-sm font-medium text-neutral-900 group-hover:text-blue-600 dark:text-neutral-100 dark:group-hover:text-blue-400">
              Learn more
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
            <div className={`mb-6 inline-flex rounded-2xl bg-gradient-to-br ${feature.color} p-4`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="mb-4 text-4xl font-bold text-neutral-900 dark:text-neutral-100">
              {feature.details.headline}
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
              {feature.details.content}
            </p>

            <div className="grid gap-6 sm:grid-cols-3">
              {feature.details.metrics.map((metric, idx) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="rounded-xl bg-white/50 p-6 backdrop-blur-sm dark:bg-neutral-800/50"
                >
                  <div className={`mb-2 text-3xl font-bold bg-gradient-to-br ${feature.color} bg-clip-text text-transparent`}>
                    {metric.value}
                  </div>
                  <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {metric.label}
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
                Ready to get started?
              </h3>
              <p className="mb-6 text-neutral-700 dark:text-neutral-300">
                Join thousands of teams already using this feature to transform their workflow.
              </p>
              <button
                className={`rounded-lg bg-gradient-to-r ${feature.color} px-6 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105`}
              >
                Start Free Trial
              </button>
            </motion.div>
          </motion.div>
        </div>
      </ExpandableScreenContent>
    </ExpandableScreen>
  )
}

export default function LandingPage() {
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
              Build Better,{" "}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Ship Faster
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
              The all-in-one platform that empowers teams to create exceptional products with
              confidence and speed.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <FeatureCarousel
              title="See it in action"
              description="Experience the power of our platform"
              image={carouselImages}
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
              Everything you need to succeed
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
              Click any feature to explore how it can transform your workflow
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <ExpandableFeatureCard key={feature.title} feature={feature} index={index} />
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
            <h2 className="mb-4 text-4xl font-bold text-white">Ready to transform your workflow?</h2>
            <p className="mb-8 text-xl text-blue-100">
              Join thousands of teams building better products with our platform.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <button className="rounded-lg bg-white px-8 py-4 font-semibold text-blue-600 shadow-lg transition-transform hover:scale-105">
                Start Free Trial
              </button>
              <button className="rounded-lg border-2 border-white px-8 py-4 font-semibold text-white transition-all hover:bg-white/10">
                Schedule Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
