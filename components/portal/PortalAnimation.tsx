"use client";

import { useEffect, useRef } from "react";
import { useScroll, motion, useTransform } from "framer-motion";
import Lenis from "lenis";
import Scene1Chaos from "./Scene1Chaos";
import Scene2Digital from "./Scene2Digital";
import Scene3Dashboard from "./Scene3Dashboard";
import Scene4Invoice from "./Scene4Invoice";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ProblemSection from "./ProblemSection";
import CTASection from "./CTASection";

export default function PortalAnimation() {
  const container = useRef<HTMLDivElement>(null);
  
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
    offset: ["start start", "end end"]
  });

  // Hero Copywriting scroll animation (0.0 -> 0.25)
  const heroY = useTransform(scrollYProgress, [0, 0.25], ["0%", "-100%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, 0.95]);

  return (
    <div className="w-full bg-white flex flex-col min-h-screen">
      <Navbar />

      {/* Main sticky animation container */}
      <div ref={container} className="relative h-[400vh] w-full bg-white">
        <div className="sticky top-0 left-0 h-screen w-full overflow-hidden">
          {/* Animated Hero Section Overlay (Priority z-index at start) */}
          <motion.div
            style={{ y: heroY, opacity: heroOpacity, scale: heroScale }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-40 pointer-events-none"
          >
            <div className="max-w-4xl flex flex-col gap-6 items-center">
              <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-none">
                Aligning Trust Between <br />
                <span className="text-lime-600 font-black" style={{
                  textShadow: "3px 3px 0 rgba(163, 230, 53, 0.2), 6px 6px 0 rgba(0, 0, 0, 0.05)"
                }}>
                  Clients & Freelancers
                </span>
              </h1>
              <p className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto font-medium leading-relaxed">
                Veritas provides secure escrow, fluid milestone tracking, and seamless project handouts. Scroll to experience the portal.
              </p>
            </div>
          </motion.div>

          <Scene1Chaos progress={scrollYProgress} />
          <Scene2Digital progress={scrollYProgress} />
          <Scene3Dashboard progress={scrollYProgress} />
          <Scene4Invoice progress={scrollYProgress} />
        </div>
      </div>

      {/* Marketing & Footer Section in normal flow (resolves upward-flying footer) */}
      <div className="relative bg-white z-50">
        <ProblemSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
