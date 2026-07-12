"use client";

import { motion, MotionValue, useTransform } from "framer-motion";
import { FileText } from "lucide-react";
import { StickyNote } from "lucide-react";


interface StickyProps {
  className?: string;
  color: string;
  accent: string;
  title: string;
}

function Sticky({
  className = "",
  color,
  accent,
  title,
}: StickyProps) {
  return (
    <div className={`absolute ${className}`}>

      <div className="absolute inset-0 translate-y-5 blur-2xl rounded-[28px] bg-black/25" />

      <div
        className="relative w-40 h-40 rounded-[28px] p-5 overflow-hidden"
        style={{
          background: color,
          boxShadow: `
            inset 0 2px 3px rgba(255,255,255,.45),
            inset 0 -8px 18px rgba(0,0,0,.08),
            0 18px 32px rgba(0,0,0,.22)
          `,
        }}
      >
        {/* Paper texture */}

        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,.4) 1px, transparent 0)",
            backgroundSize: "8px 8px",
          }}
        />

        {/* Fold */}

        <div
          className="absolute top-0 right-0 w-10 h-10 rounded-bl-2xl"
          style={{
            background:
              "linear-gradient(225deg,rgba(255,255,255,.8),transparent)",
          }}
        />

        <div
          className="w-16 h-2 rounded-full mb-5"
          style={{ background: accent }}
        />

        <p className="font-bold text-neutral-800 leading-snug text-base">
          {title}
        </p>

        <StickyNote
          className="absolute bottom-5 right-5 text-black/15"
          size={24}
        />
      </div>
    </div>
  );
}

function Calculator({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`absolute ${className}`}>

      <div className="absolute inset-0 blur-3xl translate-y-8 bg-black/30 rounded-[40px]" />

      <div
        className="
        relative
        w-[200px]
        rounded-[36px]
        p-5
        bg-[#f4f1eb]
      "
        style={{
          boxShadow: `
          inset 0 2px 3px rgba(255,255,255,.9),
          inset 0 -8px 18px rgba(0,0,0,.08),
          0 25px 45px rgba(0,0,0,.25)
        `,
        }}
      >
        <div className="rounded-2xl bg-[#2b332f] h-16 flex items-center justify-end px-4">

          <span className="font-mono text-2xl text-[#b8ffb4]">
            2,450
          </span>

        </div>

        <div className="grid grid-cols-4 gap-3 mt-5">

          {Array.from({ length: 16 }).map((_, i) => (
            <button
              key={i}
              className="
              aspect-square
              rounded-xl
              bg-neutral-200
              active:translate-y-1
              transition-transform
            "
              style={{
                boxShadow: `
                inset 0 2px 2px rgba(255,255,255,.9),
                inset 0 -4px 6px rgba(0,0,0,.08)
              `,
              }}
            />
          ))}

        </div>
      </div>
    </div>
  );
}

interface Props {
  progress: MotionValue<number>;
}


interface PaperStackProps {
  className?: string;
  rotate?: string;
  clipColor?: string;
  title: string;
  stamp?: boolean;
}

function PaperStack({
  className = "",
  rotate = "",
  clipColor = "#D6A33C",
  title,
  stamp = false,
}: PaperStackProps) {
  return (
    <div className={`absolute ${rotate} ${className}`}>

      {/* contact shadow */}

      <div className="absolute inset-0 translate-y-5 blur-3xl bg-black/25 rounded-[36px]" />

      {/* stack */}

      <div className="relative w-[250px] sm:w-[280px] md:w-[300px] aspect-[0.72]">

        {/* bottom sheets */}

        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-[28px] border border-stone-200"
            style={{
              transform: `translate(${i * 2}px, ${i * 3}px)`,
              background:
                "linear-gradient(180deg,#fdfbf8,#f5efe7)",
            }}
          />
        ))}

        {/* top page */}

        <div
          className="
          absolute
          inset-0
          rounded-[28px]
          bg-[#FFFDF8]
          overflow-hidden
        "
          style={{
            boxShadow: `
              inset 0 1px 0 rgba(255,255,255,.9),
              inset 0 -12px 18px rgba(0,0,0,.03),
              0 18px 35px rgba(0,0,0,.18)
            `,
          }}
        >
          {/* paper fibers */}

          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(0,0,0,.4) 1px, transparent 0)",
              backgroundSize: "10px 10px",
            }}
          />

          {/* highlight */}

          <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-amber-50/50" />

          {/* curled corner */}

          <div className="absolute top-0 right-0 w-12 h-12">

            <div
              className="
              absolute
              inset-0
              rounded-bl-2xl
              bg-gradient-to-bl
              from-[#efe7dc]
              to-white
              shadow-inner
            "
            />

          </div>

          {/* binder clip */}

          <div className="absolute -top-4 left-8">

            <div
              className="w-12 h-9 rounded-b-lg"
              style={{ background: clipColor }}
            />

            <div className="absolute left-2 -top-4 w-8 h-8 rounded-full border-[3px] border-stone-500" />

          </div>

          {/* title */}

          <div className="pt-14 px-8">

            <div className="text-2xl font-black tracking-tight text-stone-800">
              {title}
            </div>

            <div className="mt-2 h-[2px] bg-stone-300 rounded-full" />

            <div className="space-y-3 mt-8">

              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-2 rounded-full bg-stone-200"
                  style={{
                    width: `${90 - Math.random() * 25}%`,
                  }}
                />
              ))}

            </div>

          </div>

          {/* footer */}

          <div className="absolute bottom-7 left-8 right-8 flex justify-between items-end">

            <div className="space-y-2">

              <div className="w-28 h-[2px] bg-stone-400 rounded-full" />

              <div className="text-xs uppercase tracking-widest text-stone-500">
                Signature
              </div>

            </div>

            <FileText className="text-stone-300 w-8 h-8" />

          </div>

          {stamp && (
            <div
              className="
              absolute
              bottom-16
              right-8
              w-20
              h-20
              rounded-full
              border-[5px]
              border-rose-400/60
              flex
              items-center
              justify-center
              rotate-12
              text-[10px]
              font-black
              tracking-widest
              text-rose-500
            "
            >
              APPROVED
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoffeeMug({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`absolute ${className}`}>

      <div className="absolute inset-0 blur-2xl bg-black/30 rounded-full" />

      <div className="relative w-24 h-24">

        {/* Saucer */}

        <div className="absolute -inset-3 rounded-full bg-stone-200 shadow-inner" />

        {/* Handle */}

        <div className="absolute top-7 -right-5 w-10 h-12 rounded-full border-[8px] border-white" />

        {/* Cup */}

        <div className="absolute inset-0 rounded-full bg-white flex items-center justify-center shadow-xl">

          <div className="w-[80%] h-[80%] rounded-full bg-[#6b4024] flex items-center justify-center">

            <div className="w-8 h-8 border-[3px] rounded-full border-[#d8a36d] rotate-45" />

          </div>

        </div>

      </div>

    </div>
  );
}

function Pencil({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`absolute ${className}`}>

      <div className="flex items-center">

        <div className="w-6 h-8 rounded-l-lg bg-pink-400" />

        <div className="w-4 h-8 bg-stone-300" />

        <div
          className="w-32 h-8 bg-[#efb94b]"
          style={{
            background:
              "linear-gradient(180deg,#ffd36b,#efb94b)",
          }}
        />

        <div className="border-y-[16px] border-y-transparent border-l-[22px] border-l-[#e2c39d] relative">

          <div className="absolute top-1/2 -translate-y-1/2 -left-[2px] border-y-[4px] border-y-transparent border-l-[6px] border-l-neutral-900" />

        </div>

      </div>

    </div>
  );
}

const DUST = Array.from({ length: 22 }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 3 + 1,
  duration: 10 + Math.random() * 10,
  delay: Math.random() * 6,
}));

export default function Scene1Chaos({ progress }: Props) {
  const y = useTransform(progress, [0, 0.22], ["0%", "-120%"]);
  const opacity = useTransform(progress, [0, 0.18, 0.22], [1, 1, 0]);

  return (
    <motion.div
      style={{ y, opacity }}
      className="absolute inset-0 overflow-hidden bg-[#e9dbc8]"
    >
      {/* ======================================= */}
      {/* WOOD DESK */}
      {/* ======================================= */}

      <div className="absolute inset-0">

        {/* warm wood gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#8d6547] via-[#6f4f37] to-[#4f3524]" />

        {/* subtle wood grain */}
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-multiply"
          style={{
            backgroundImage: `
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,.15) 0px,
              rgba(255,255,255,.15) 2px,
              transparent 3px,
              transparent 14px
            )`,
          }}
        />

        {/* soft noise */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(0,0,0,.4) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      {/* ======================================= */}
      {/* WINDOW LIGHT */}
      {/* ======================================= */}

      <div
        className="
        absolute
        -top-20
        -left-32
        w-[1200px]
        h-[900px]
        rounded-full
        bg-amber-200/60
        blur-[140px]
        mix-blend-screen
      "
      />

      <div
        className="
        absolute
        -top-20
        left-20
        w-[900px]
        h-[700px]
        rounded-full
        bg-orange-100/50
        blur-[180px]
        mix-blend-screen
      "
      />

      {/* warm sunlight */}
      <div
        className="
        absolute
        inset-0
        bg-[radial-gradient(circle_at_22%_18%,rgba(255,239,194,.55),transparent_45%)]
        pointer-events-none
      "
      />

      {/* bloom */}
      <div
        className="
        absolute
        inset-0
        bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.18),transparent_32%)]
        mix-blend-screen
      "
      />

      {/* ======================================= */}
      {/* WINDOW SHADOW */}
      {/* ======================================= */}

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(
              115deg,
              transparent 25%,
              rgba(40,20,10,.35) 27%,
              transparent 29%,
              transparent 44%,
              rgba(40,20,10,.35) 46%,
              transparent 48%
            )
          `,
        }}
      />

      {/* ======================================= */}
      {/* ATMOSPHERIC HAZE */}
      {/* ======================================= */}

      <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />

      {/* ======================================= */}
      {/* DUST */}
      {/* ======================================= */}

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
        {DUST.map((dust) => (
          <motion.div
            key={dust.id}
            className="absolute rounded-full bg-amber-50 shadow-[0_0_14px_rgba(255,240,180,.75)]"
            style={{
              width: dust.size,
              height: dust.size,
              left: `${dust.x}%`,
              top: `${dust.y}%`,
            }}
            animate={{
              y: [-30, -180],
              opacity: [0, .7, 0],
              x: [0, dust.id % 2 === 0 ? 25 : -25],
              scale: [1, 1.3, .8],
            }}
            transition={{
              repeat: Infinity,
              ease: "linear",
              duration: dust.duration,
              delay: dust.delay,
            }}
          />
        ))}
      </div>

      {/* ======================================= */}
      {/* LEATHER DESK MAT */}
      {/* ======================================= */}

      <div
        className="
        absolute
        left-1/2
        top-1/2
        -translate-x-1/2
        -translate-y-1/2

        w-[96%]
        md:w-[92%]

        h-[92%]

        rounded-[42px]

        bg-gradient-to-br
        from-slate-700
        via-slate-800
        to-slate-900

        overflow-hidden

        z-10
      "
        style={{
          boxShadow: `
            inset 0 2px 4px rgba(255,255,255,.15),
            inset 0 -8px 18px rgba(0,0,0,.35),
            0 45px 80px rgba(0,0,0,.35)
          `,
        }}
      >
        {/* leather grain */}

        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,.7) 1px, transparent 0)",
            backgroundSize: "12px 12px",
          }}
        />

        {/* subtle highlight */}

        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />

        {/* stitched border */}

        <div className="absolute inset-5 rounded-[34px] border-[3px] border-amber-100/20 border-dashed" />
      </div>

      {/* ======================================= */}
      {/* MOBILE SAFE AREA */}
      {/* ======================================= */}

      <div
        className="
        absolute
        inset-0

        scale-[0.86]
        sm:scale-90
        md:scale-100

        origin-center

        z-30
      ">

        {/*
          PART TWO STARTS HERE

          PaperStack
          Coffee
          Calculator
          Sticky Notes
          Pencil

        */}
        <PaperStack
  title="Purchase Agreement"
  stamp
  rotate="-rotate-6"
  className="
    top-[10%]
    left-[4%]

    md:left-[8%]

    scale-75
    sm:scale-90
    md:scale-100
  "
/>

{/* RIGHT CONTRACT */}

<PaperStack
  title="Escrow Instructions"
  rotate="rotate-6"
  clipColor="#9CA3AF"
  className="
    bottom-[8%]
    right-[2%]

    md:right-[8%]

    scale-75
    sm:scale-90
    md:scale-100
  "
/>

<Sticky
  color="#A7F3D0"
  accent="#10B981"
  title="Update escrow before Friday."
  className="
  top-[16%]
  right-[22%]
  rotate-6
  hidden sm:block
  "
/>

<Sticky
  color="#FBCFE8"
  accent="#EC4899"
  title="Verify buyer documents."
  className="
  bottom-[24%]
  left-[20%]
  -rotate-6
  hidden md:block
  "
/>

<Calculator
  className="
  top-[36%]
  right-[5%]
  rotate-[-12deg]
  scale-75
  md:scale-100
  "
/>

<CoffeeMug
  className="
  left-[45%]
  top-[30%]
  rotate-12
  "
/>

<Pencil
  className="
  left-[36%]
  top-[56%]
  -rotate-45
  "
/>

      </div>

      {/* vignette */}

      <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_55%,rgba(0,0,0,.35)_100%)] pointer-events-none" />
    </motion.div>
  );
}

  
      {/* Cartoonish Chunky Calculator (Teenage Engineering Vibe) */}
      <div 
        className="absolute top-[38%] right-[10%] rotate-[-18deg] bg-[#eef2f6] w-48 h-64 rounded-[32px] p-4 flex flex-col justify-between z-30"
        style={{
          boxShadow: "10px 14px 0px rgba(148,163,184,1), 40px 60px 90px rgba(2, 5, 10, 0.9), inset 4px 6px 12px rgba(255,255,255,1), inset -4px -6px 15px rgba(0,0,0,0.1)",
        }}
      >
        {/* Screen */}
        <div className="bg-[#1e293b] border-4 border-[#0f172a] w-full h-16 rounded-2xl flex justify-end items-center px-4 font-mono text-cyan-400 font-black text-2xl tracking-widest shadow-[inset_0_6px_12px_rgba(0,0,0,0.8)]">
          2,500
        </div>
        
        {/* Chunky Rubber Buttons */}
        <div className="grid grid-cols-4 gap-3 mt-5 flex-1">
          {Array.from({length: 12}).map((_, i) => (
            <div 
              key={i} 
              // The "=" button is vibrant orange, others are slate
              className={`${i === 11 ? 'bg-orange-400 border-orange-600' : 'bg-[#d1d5db] border-[#9ca3af]'} 
                rounded-xl border-b-[5px] active:border-b-[0px] active:translate-y-[5px] transition-all cursor-pointer flex items-center justify-center text-sm font-black text-slate-800 shadow-[0_4px_6px_rgba(0,0,0,0.2),inset_0_2px_4px_rgba(255,255,255,0.8)]`}
            >
              {i === 11 ? "=" : i}
            </div>
          ))}
        </div>
      </div>

      {/* =========================================
          5. CUSTOM 3D OBJECTS (Replacing Flat Icons)
          ========================================= */}

      {/* Top-Down Cartoon Coffee Mug */}
      <div className="absolute top-[32%] left-[44%] z-30 rotate-12 drop-shadow-[15px_25px_15px_rgba(5,10,15,0.8)]">
        <div className="relative w-20 h-20">
          {/* Cup Handle */}
          <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-10 h-12 rounded-full border-[8px] border-white shadow-[inset_0_-4px_4px_rgba(0,0,0,0.1)]" />
          {/* Saucer */}
          <div className="absolute inset-[-12px] bg-slate-300 rounded-full shadow-[inset_2px_4px_6px_rgba(255,255,255,0.8),inset_-4px_-4px_8px_rgba(0,0,0,0.2)]" />
          {/* Cup Body */}
          <div className="absolute inset-0 bg-white rounded-full shadow-[inset_-4px_-8px_12px_rgba(0,0,0,0.15),0_8px_16px_rgba(0,0,0,0.3)] flex items-center justify-center">
            {/* Coffee Liquid */}
            <div className="w-[85%] h-[85%] bg-[#3d2314] rounded-full shadow-[inset_0_8px_8px_rgba(0,0,0,0.6)] flex items-center justify-center">
              {/* Milk Art / Crema swirl */}
              <div className="w-1/2 h-1/2 rounded-full border-[3px] border-[#c08d5d]/80 blur-[1px] rotate-45 translate-x-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Chunky 3D Pencil */}
      <div className="absolute top-[48%] left-[38%] z-20 -rotate-45 drop-shadow-[15px_20px_15px_rgba(5,10,15,0.8)]">
        <div className="flex items-center">
          {/* Eraser */}
          <div className="w-6 h-8 bg-pink-400 rounded-l-lg shadow-[inset_2px_4px_4px_rgba(255,255,255,0.4),inset_0_-3px_4px_rgba(0,0,0,0.2)]" />
          {/* Metal Band */}
          <div className="w-4 h-8 bg-slate-300 shadow-[inset_0_4px_4px_rgba(255,255,255,0.8),inset_0_-3px_4px_rgba(0,0,0,0.3)] flex flex-col justify-evenly py-1">
             <div className="w-full h-[2px] bg-slate-400" />
             <div className="w-full h-[2px] bg-slate-400" />
          </div>
          {/* Body */}
          <div className="w-24 h-8 bg-amber-400 shadow-[inset_0_4px_4px_rgba(255,255,255,0.5),inset_0_-3px_6px_rgba(200,100,0,0.4)] flex flex-col">
            <div className="w-full h-1/3 border-b border-amber-500/30" />
            <div className="w-full h-1/3 border-b border-amber-500/30" />
          </div>
          {/* Wood Tip */}
          <div className="w-0 h-0 border-y-[16px] border-y-transparent border-l-[20px] border-l-[#d2b48c] shadow-[inset_4px_0_4px_rgba(0,0,0,0.1)] relative">
            {/* Graphite tip */}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-0 h-0 border-y-[4px] border-y-transparent border-l-[5px] border-l-slate-800" />
          </div>
        </div>
      </div>

