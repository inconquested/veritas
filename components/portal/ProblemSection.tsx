"use client";

import { AlertCircle, CheckCircle, Clock, ShieldAlert } from "lucide-react";

export default function ProblemSection() {
  const problems = [
    {
      icon: <AlertCircle className="w-8 h-8 text-red-500" />,
      title: "Vague Requirements",
      description: "Contracts and scopes scattered across physical notebooks, sticky notes, and text messages lead to misalignment.",
    },
    {
      icon: <Clock className="w-8 h-8 text-red-500" />,
      title: "Delayed Milestones",
      description: "Tracking progress via spreadsheets and emails makes it hard to see when work is actually done.",
    },
    {
      icon: <ShieldAlert className="w-8 h-8 text-red-500" />,
      title: "Escrow Friction",
      description: "Paying upfront creates client risk, while waiting until final delivery leaves freelancers exposed to non-payment.",
    },
  ];

  return (
    <section className="w-full bg-[#fcfbfa] py-24 border-t border-gray-100 relative z-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Freelance projects shouldn&apos;t feel like tabletop chaos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((prob, i) => (
            <div
              key={i}
              className="bg-white border-2 border-gray-300/80 p-8 rounded-xl flex flex-col gap-4 relative transform transition-transform hover:-rotate-1 hover:scale-105"
              style={{
                boxShadow: "8px 8px 0 rgba(220, 38, 38, 0.1), 12px 12px 20px rgba(90, 80, 70, 0.08)",
              }}
            >
              <div className="absolute -top-3 -right-3 w-12 h-12 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center shadow-lg transform rotate-12">
                <span className="text-2xl font-black text-red-500">!</span>
              </div>
              <div className="p-4 bg-red-50 border-2 border-red-200/60 rounded-xl w-fit shadow-inner">{prob.icon}</div>
              <h3 className="text-xl font-bold text-slate-800">{prob.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{prob.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
