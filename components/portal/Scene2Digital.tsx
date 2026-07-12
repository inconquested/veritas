"use client";

import { motion, MotionValue, useTransform } from "framer-motion";
import { FileText, Layout, Sparkles } from "lucide-react";

interface Props {
  progress: MotionValue<number>;
}

export default function Scene2Digital({ progress }: Props) {
  // Scene timeline: 0.25 - 0.52 (fade in, visible, fade out)
  const opacity = useTransform(progress, [0.25, 0.3, 0.47, 0.52], [0, 1, 1, 0]);
  const mockupY = useTransform(progress, [0.3, 0.42], [50, 0]);
  const mockupRotate = useTransform(progress, [0.3, 0.42], [8, 0]);

  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 bg-gradient-to-br from-lime-50 via-white to-gray-50 flex items-center justify-center px-6 md:px-12 z-20"
    >
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: Message */}
        <div className="space-y-4 lg:space-y-6 text-center lg:text-left px-4 lg:px-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 bg-lime-100 border border-lime-300 rounded-full text-sm">
            <Sparkles className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-lime-700" />
            <span className="text-xs lg:text-sm font-semibold text-lime-900">Digital Transformation</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
            From Chaos to <span className="text-lime-600">Clarity</span>
          </h2>

          <p className="text-base lg:text-lg text-gray-600 leading-relaxed max-w-lg mx-auto lg:mx-0">
            Transform scattered papers and endless emails into a unified digital workspace where every project detail lives in one secure place.
          </p>

          <div className="flex flex-wrap gap-2 lg:gap-4 justify-center lg:justify-start">
            {['Secure Storage', 'Real-time Sync', 'Easy Access'].map((feature) => (
              <div key={feature} className="flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-lime-500 rounded-full" />
                <span className="text-xs lg:text-sm font-medium text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Decorative App Mockup */}
        <motion.div
          style={{ y: mockupY, rotate: mockupRotate }}
          className="relative px-4 lg:px-0"
        >
          <div className="relative bg-white border-2 border-gray-300 rounded-xl lg:rounded-2xl shadow-2xl overflow-hidden max-w-lg mx-auto lg:max-w-none">
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-lime-500/5 to-transparent pointer-events-none" />

            {/* Browser chrome */}
            <div className="border-b border-gray-200 bg-gray-50 px-3 lg:px-4 py-2 lg:py-3 flex items-center gap-2">
              <div className="flex gap-1 lg:gap-1.5">
                <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-red-400" />
                <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-yellow-400" />
                <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-2 lg:mx-4 bg-white border border-gray-200 rounded px-2 lg:px-3 py-1 lg:py-1.5 text-[10px] lg:text-xs text-gray-400 truncate">
                veritas.app/dashboard
              </div>
            </div>

            {/* App content */}
            <div className="flex">
              {/* Sidebar */}
              <div className="w-12 lg:w-16 border-r border-gray-200 bg-gray-50 py-3 lg:py-4 flex flex-col items-center gap-2 lg:gap-3">
                <div className="w-7 h-7 lg:w-10 lg:h-10 bg-lime-500 rounded-lg flex items-center justify-center">
                  <Layout className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-white" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-7 h-7 lg:w-10 lg:h-10 bg-white border border-gray-200 rounded-lg" />
                ))}
              </div>

              {/* Main area */}
              <div className="flex-1 p-3 lg:p-6 space-y-2 lg:space-y-3">
                <div className="h-6 lg:h-8 w-24 lg:w-32 bg-gray-800 rounded" />
                <div className="grid grid-cols-2 gap-2 lg:gap-3">
                  {['Brief.pdf', 'Contract.pdf', 'Design.fig', 'Invoice.pdf'].map((file) => (
                    <div key={file} className="aspect-square border-2 border-gray-200 rounded-lg lg:rounded-xl bg-gradient-to-br from-white to-gray-50 flex flex-col items-center justify-center gap-0.5 lg:gap-1 hover:border-lime-400 transition-all hover:shadow-lg hover:-translate-y-0.5">
                      <FileText className="w-5 h-5 lg:w-8 lg:h-8 text-gray-400" />
                      <span className="text-[9px] lg:text-xs font-medium text-gray-600 px-1 text-center leading-tight">{file}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating decoration - hidden on mobile */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="hidden lg:block absolute -top-4 -right-4 w-20 h-20 bg-lime-400 rounded-full blur-2xl opacity-60"
          />
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="hidden lg:block absolute -bottom-4 -left-4 w-16 h-16 bg-blue-400 rounded-full blur-2xl opacity-40"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
