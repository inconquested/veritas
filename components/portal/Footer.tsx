"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <div className="px-4 pb-4 md:px-6 md:pb-6">
      <footer className="w-full bg-neutral-950 rounded-[2rem] md:rounded-[3rem] text-neutral-400 overflow-hidden relative z-50">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 pt-16 md:pt-24 pb-12 md:px-12 grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-8">
          
          {/* Brand & Description */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-white shadow-sm transition-transform duration-200 group-active:scale-90">
                <Sparkles className="size-5 text-[#a3e635]" />
              </div>
              <span className="font-semibold text-white tracking-tight text-xl">
                Veritas
              </span>
            </Link>
            <p className="text-sm leading-relaxed max-w-sm text-neutral-400">
              The secure client-freelancer portal built for speed, transparency, and safety. Building trust one milestone at a time.
            </p>
          </div>

          {/* Links Grid */}
          <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-6">Product</h4>
              <div className="flex flex-col gap-4 text-sm">
                <Link href="#" className="hover:text-white transition-colors">Escrow Payments</Link>
                <Link href="#" className="hover:text-white transition-colors">Milestones</Link>
                <Link href="#" className="hover:text-white transition-colors">Security</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-6">Company</h4>
              <div className="flex flex-col gap-4 text-sm">
                <Link href="#" className="hover:text-white transition-colors">About Us</Link>
                <Link href="#" className="hover:text-white transition-colors">Blog</Link>
                <Link href="#" className="hover:text-white transition-colors">Careers</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-6">Legal</h4>
              <div className="flex flex-col gap-4 text-sm">
                <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Big Typography & Bottom Bar */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col items-center">
          {/* Top border divider */}
          <div className="w-full h-px bg-neutral-800/50 mb-8" />
          
          <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 text-sm mb-12">
            <span>© {new Date().getFullYear()} Veritas Inc. All rights reserved.</span>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
              <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
            </div>
          </div>

          {/* Massive Text */}
          <div className="w-full overflow-hidden flex justify-center pb-4">
            <h1 className="text-[18vw] md:text-[14vw] font-bold tracking-tighter leading-none text-neutral-800/80 select-none">
              VERITAS
            </h1>
          </div>
        </div>
      </footer>
    </div>
  );
}