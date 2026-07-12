"use client";

import { motion, MotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Check, Lock, ShieldCheck, Zap } from "lucide-react";
import { Button } from "../ui/button";

interface Props {
  progress: MotionValue<number>;
}

export default function Scene4Invoice({ progress }: Props) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [amount, setAmount] = useState(0);

  // Scene timeline: 0.8 - 1.0
  const opacity = useTransform(progress, [0.8, 0.85, 1.0], [0, 1, 1]);
  const cardScale = useTransform(progress, [0.8, 0.88], [0.9, 1]);
  const cardY = useTransform(progress, [0.8, 0.88], [40, 0]);

  useEffect(() => {
    return progress.onChange((latest) => {
      if (latest > 0.8 && latest <= 0.88) {
        setAmount(Math.floor(((latest - 0.8) / 0.08) * 2500));
      } else if (latest > 0.88) {
        setAmount(2500);
      }
      setShowSuccess(latest > 0.92);
    });
  }, [progress]);

  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 bg-[#FAFAFA] flex items-center justify-center px-6 md:px-12 z-40 overflow-hidden"
    >
      {/* Background Ambient Noise/Glow */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[800px] h-[600px] bg-gradient-to-tr from-lime-100/40 to-emerald-50/40 blur-[120px] rounded-full opacity-60" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
        
        {/* Left: Refined Message */}
        <div className="space-y-8 text-center lg:text-left order-2 lg:order-1 px-4 lg:px-0">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200/60 rounded-full shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
              <div className="bg-lime-100 rounded-full p-1">
                <ShieldCheck className="w-3.5 h-3.5 text-lime-600" />
              </div>
              <span className="text-xs font-semibold text-neutral-600 tracking-wide uppercase">
                Secure Escrow
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-neutral-900 tracking-tighter leading-[1.1]">
              Release with <br className="hidden lg:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-lime-500 to-emerald-600">
                absolute certainty.
              </span>
            </h2>

            <p className="text-lg text-neutral-500 leading-relaxed max-w-md mx-auto lg:mx-0 font-medium">
              Funds stay locked in a tamper-proof vault. When the work hits your standard, release payment with a single, satisfying tap.
            </p>
          </div>

          <div className="space-y-4 lg:space-y-5 pt-2">
            {[
              { icon: Lock, label: 'Vault Protection', detail: 'Funds held in secure escrow' },
              { icon: Zap, label: 'Instant Settlement', detail: 'Zero-delay transfers' },
            ].map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-center gap-4 justify-center lg:justify-start group">
                <div className="w-10 h-10 bg-white border border-neutral-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-300">
                  <Icon className="w-4 h-4 text-neutral-700" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-neutral-900">{label}</span>
                  <span className="text-xs text-neutral-500 font-medium">{detail}</span>
                </div>
              </div>
            ))}
            <Button>Try now</Button>
          </div>
        </div>

        {/* Right: Tactile Payment Card */}
        <div className="relative order-1 lg:order-2 px-4 lg:px-0 flex justify-center lg:justify-end">
          
          {/* Decorative floating blur behind card */}
          <motion.div
            animate={{ scale: [1, 1.05, 1], rotate: [0, 2, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-lime-400/20 blur-[80px] rounded-full z-0"
          />

          <motion.div 
            style={{ scale: cardScale, y: cardY }} 
            className="relative z-10 w-full max-w-[400px]"
          >
            {/* The physical card container */}
            <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-2 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.8)] relative overflow-hidden">
              
              <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-neutral-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)] relative overflow-hidden">
                
                {/* Header inside card */}
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-neutral-200 to-neutral-100 border border-neutral-200 shadow-sm flex items-center justify-center overflow-hidden">
                       {/* Abstract avatar placeholder */}
                       <div className="w-full h-full bg-gradient-to-b from-transparent to-neutral-300/50 translate-y-2 rounded-full" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-neutral-900">Alex Designer</span>
                      <span className="text-[10px] font-medium text-neutral-400">Milestone 2</span>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 bg-neutral-100 rounded-full text-[10px] font-semibold text-neutral-500 border border-neutral-200/80">
                    #VR-8829
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1 mb-8">
                  <span className="text-sm font-semibold text-neutral-400 block">Total Due</span>
                  <div className="text-5xl lg:text-6xl font-semibold tracking-tighter text-neutral-900 tabular-nums">
                    ${amount.toLocaleString()}
                    <span className="text-3xl text-neutral-300">.00</span>
                  </div>
                </div>

                {/* Button */}
                <button className="w-full relative group overflow-hidden rounded-2xl bg-neutral-900 text-white font-medium py-4 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)] transition-transform active:scale-95 flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4 text-neutral-400 group-hover:text-white transition-colors" />
                  <span>Release Funds</span>
                </button>

                {/* Success Overlay (Frosted Glass + 3D Badge) */}
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                      animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/60 z-20 flex flex-col items-center justify-center"
                    >
                      <motion.div
                        initial={{ scale: 0.5, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                        // "Cartoonish Photorealistic" 3D badge styling
                        className="w-20 h-20 rounded-full bg-gradient-to-b from-lime-400 to-lime-500 border-[3px] border-white shadow-[0_20px_40px_-10px_rgba(132,204,22,0.5),inset_0_4px_8px_rgba(255,255,255,0.6)] flex items-center justify-center mb-4"
                      >
                        <Check className="w-10 h-10 text-white drop-shadow-md" strokeWidth={3} />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-center"
                      >
                        <div className="text-xl font-bold text-neutral-900 tracking-tight">Payment Released</div>
                        <div className="text-sm font-medium text-neutral-500 mt-1">Funds securely transferred</div>
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