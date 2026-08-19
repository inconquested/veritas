"use client";

import Link from "next/link";
import { Sparkles, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import LanguageToggle from "./LanguageToggle";

export default function Navbar() {
  const t = useTranslations("portal");
  const [scrolled, setScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("features");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    const handleResize = () => {
      if (window.innerWidth >= 768 && isOpen) setIsOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  const navLinks = [
    { id: "features", name: t("navbar.features"), href: "#features" },
    { id: "pricing", name: t("navbar.pricing"), href: "#pricing" },
    { id: "signIn", name: t("navbar.signIn"), href: "/login" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 transition-all duration-500 ease-out ${
          scrolled ? "pt-3 sm:pt-4" : "pt-4 sm:pt-6 md:pt-8"
        }`}
      >
        <nav
          className={`flex items-center justify-between w-full max-w-4xl gap-2 transition-all duration-500 ease-out ${
            scrolled
              ? "bg-white/70 backdrop-blur-xl border border-neutral-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-full px-3 sm:px-4 py-2 sm:py-2.5"
              : "bg-transparent border-transparent px-2 py-2"
          }`}
        >
          <Link
            href="/"
            onClick={() => setActiveTab("")}
            className="flex items-center gap-2 sm:gap-2.5 group z-50 shrink-0"
          >
            <div className="flex aspect-square size-7 sm:size-8 items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800 text-white shadow-sm transition-transform duration-200 group-active:scale-90">
              <Sparkles className="size-3.5 sm:size-4 text-[#a3e635]" />
            </div>
            <span className="font-semibold text-neutral-900 tracking-tight text-sm">
              Veritas
            </span>
          </Link>

          <div className="hidden md:flex items-center p-1">
            {navLinks.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-4 py-1.5 text-sm font-medium transition-colors rounded-full z-10 ${
                    isActive
                      ? "text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-200/50 -z-10"
                      initial={false}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                        mass: 1,
                      }}
                    />
                  )}
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <LanguageToggle />
            <Link
              href="/signup"
              className="bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-2 rounded-full font-medium transition-all shadow-sm active:scale-95 text-sm ring-2 ring-transparent focus-visible:ring-neutral-400"
            >
              {t("navbar.getStarted")}
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <LanguageToggle />
            <button
              className="flex items-center justify-center size-9 rounded-full bg-neutral-100/80 text-neutral-600 transition-transform active:scale-90 z-50 hover:bg-neutral-200/80"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={t("navbar.toggleMenu")}
            >
              {isOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-white/80 backdrop-blur-2xl transition-all duration-500 md:hidden ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`flex flex-col items-center justify-center h-full gap-8 transition-transform duration-500 ease-out ${
            isOpen ? "translate-y-0 scale-100" : "-translate-y-8 scale-95"
          }`}
        >
          {navLinks.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`text-2xl font-medium transition-colors ${
                activeTab === item.id ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {item.name}
            </Link>
          ))}
          <Link
            href="/signup"
            onClick={() => setIsOpen(false)}
            className="bg-neutral-900 text-white px-8 py-3.5 rounded-full font-medium transition-transform active:scale-95 shadow-sm text-lg mt-4"
          >
            {t("navbar.getStarted")}
          </Link>
        </div>
      </div>
    </>
  );
}
