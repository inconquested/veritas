"use client";

import Link from "next/link";

export default function CTASection() {
  return (
    <section className="w-full bg-white py-24 border-t border-gray-100 relative z-50 overflow-hidden">
      {/* Light backdrop glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-lime-300/10 to-transparent blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 text-center flex flex-col items-center gap-8 relative z-10">
        <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-none">
          Ready to align your <br />
          <span className="text-lime-600 font-black" style={{
            textShadow: "4px 4px 0 rgba(163, 230, 53, 0.2), 8px 8px 0 rgba(0, 0, 0, 0.05)"
          }}>
            next big project?
          </span>
        </h2>
        <p className="text-base md:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
          Create secure escrow contracts, define clean milestones, and release payments dynamically. Join Veritas today.
        </p>
        <div className="flex gap-4 mt-2">
          <Link
            href="/signup"
            className="bg-black hover:bg-gray-800 text-white px-8 py-4 rounded-full font-bold transition-all shadow-xl shadow-black/15 text-sm"
          >
            Create Your Portal
          </Link>
        </div>
      </div>
    </section>
  );
}
