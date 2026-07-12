"use client";

import { motion, MotionValue, useTransform } from "framer-motion";
import { CheckCircle2, Circle, TrendingUp } from "lucide-react";

interface Props {
  progress: MotionValue<number>;
}

export default function Scene3Dashboard({ progress }: Props) {
  // Scene timeline: 0.55 - 0.77 (fade in, animate timeline, fade out)
  const opacity = useTransform(progress, [0.55, 0.6, 0.72, 0.77], [0, 1, 1, 0]);
  const pathHeight = useTransform(progress, [0.6, 0.72], ["0%", "100%"]);
  const cardY = useTransform(progress, [0.55, 0.65], [30, 0]);

  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center px-6 md:px-12 z-30"
    >
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left: Message */}
        <div className="space-y-4 lg:space-y-6 text-center lg:text-left px-4 lg:px-0">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 bg-blue-100 border border-blue-300 rounded-full">
            <TrendingUp className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-blue-700" />
            <span className="text-xs lg:text-sm font-semibold text-blue-900">Progress Tracking</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
            Track Every <span className="text-blue-600">Milestone</span>
          </h2>

          <p className="text-base lg:text-lg text-gray-600 leading-relaxed max-w-lg mx-auto lg:mx-0">
            Watch your project progress in real-time with visual timelines, milestone tracking, and seamless file sharing between clients and freelancers.
          </p>

          <div className="space-y-2 lg:space-y-3">
            {[
              { label: 'Visual Timeline', status: 'Live updates' },
              { label: 'File Management', status: 'Instant sync' },
              { label: 'Status Tracking', status: 'Real-time' }
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center gap-2 lg:gap-3 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600 flex-shrink-0" />
                <div className="flex items-baseline gap-2">
                  <span className="text-sm lg:text-base font-semibold text-gray-900">{label}</span>
                  <span className="text-xs lg:text-sm text-gray-500">· {status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Decorative Dashboard */}
        <motion.div style={{ y: cardY }} className="relative px-4 lg:px-0">
          <div className="bg-white border-2 border-gray-300 rounded-xl lg:rounded-2xl shadow-2xl p-4 md:p-6 lg:p-8 max-w-lg mx-auto lg:max-w-none">
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-xl lg:rounded-2xl pointer-events-none" />

            <div className="relative space-y-4 lg:space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg lg:text-xl font-bold text-gray-900">Project Timeline</h3>
                <div className="px-2 lg:px-3 py-1 bg-green-100 border border-green-300 rounded-full text-[10px] lg:text-xs font-semibold text-green-700">
                  On Track
                </div>
              </div>

              {/* Timeline */}
              <div className="relative pl-6 lg:pl-8">
                <div className="absolute left-2.5 lg:left-3 top-0 bottom-0 w-0.5 bg-gray-200" />
                <motion.div
                  className="absolute left-2.5 lg:left-3 top-0 w-0.5 bg-blue-500 origin-top"
                  style={{ height: pathHeight }}
                />

                <div className="space-y-4 lg:space-y-6">
                  {[
                    { title: 'Project Scoping', status: 'Complete', icon: CheckCircle2, color: 'text-blue-500' },
                    { title: 'Development Phase', status: 'Complete', icon: CheckCircle2, color: 'text-blue-500' },
                    { title: 'Final Delivery', status: 'Pending', icon: Circle, color: 'text-gray-300' }
                  ].map(({ title, status, icon: Icon, color }) => (
                    <div key={title} className="flex items-start gap-2 lg:gap-3 relative">
                      <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${color} relative z-10 bg-white`} />
                      <div className="flex-1">
                        <div className="text-sm lg:text-base font-semibold text-gray-900">{title}</div>
                        <div className="text-xs lg:text-sm text-gray-500">{status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Files preview */}
              <div className="pt-3 lg:pt-4 border-t border-gray-200">
                <div className="text-xs lg:text-sm font-semibold text-gray-700 mb-2 lg:mb-3">Recent Files</div>
                <div className="grid grid-cols-2 gap-2">
                  {['Specs.pdf', 'Wireframes.fig'].map((file) => (
                    <div key={file} className="border border-gray-200 rounded-lg p-2 lg:p-3 bg-gradient-to-br from-white to-gray-50 hover:border-blue-400 transition-colors">
                      <div className="text-xs lg:text-sm font-medium text-gray-700 truncate">{file}</div>
                      <div className="text-[10px] lg:text-xs text-gray-500 mt-1">2 days ago</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating decorations - hidden on mobile */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="hidden lg:block absolute -top-6 -right-6 w-24 h-24 bg-blue-400 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
            className="hidden lg:block absolute -bottom-6 -left-6 w-20 h-20 bg-purple-400 rounded-full blur-3xl"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
