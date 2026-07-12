"use client";

import { ExpandableScreen, ExpandableScreenTrigger, ExpandableScreenContent } from "@/components/ui/expandable-screen";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Users, Briefcase } from "lucide-react";
import { useState } from "react";
import { updateUserRole } from "@/actions/onboarding";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"client" | "freelancer" | null>(null);

  const handleRoleSelect = async (role: "client" | "freelancer") => {
    setSelectedRole(role);
    try{
      await updateUserRole(role);

      await user?.reload()
      role === "client" ? router.push("/client/dashboard") : router.push("/freelancer/dashboard");
    } catch{
      console.error("Error")
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lime-50 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Welcome to <span className="text-lime-600">Veritas</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose your role to get started
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ExpandableScreen layoutId="client-card">
            <ExpandableScreenTrigger>
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-lime-400 transition-all cursor-pointer group">
                <div className="w-16 h-16 bg-lime-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-lime-200 transition-colors">
                  <Users className="w-8 h-8 text-lime-700" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">I'm a Client</h2>
                <p className="text-gray-600">Hire freelancers and manage projects with secure escrow payments</p>
              </div>
            </ExpandableScreenTrigger>

            <ExpandableScreenContent className="bg-gradient-to-br from-lime-500 to-lime-600">
              <div className="flex flex-col items-center justify-center h-full text-white p-12 text-center space-y-6">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Users className="w-12 h-12" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl md:text-4xl font-bold">Client Dashboard</h2>
                  <ul className="space-y-3 text-lg text-white/90">
                    <li>• Post projects and hire talent</li>
                    <li>• Track milestones in real-time</li>
                    <li>• Secure escrow payments</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleRoleSelect("client")}
                  className="mt-8 px-8 py-4 bg-white text-lime-600 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors"
                >
                  Continue as Client
                </button>
              </div>
            </ExpandableScreenContent>
          </ExpandableScreen>

          <ExpandableScreen layoutId="freelancer-card">
            <ExpandableScreenTrigger>
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 hover:border-blue-400 transition-all cursor-pointer group">
                <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                  <Briefcase className="w-8 h-8 text-blue-700" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">I'm a Freelancer</h2>
                <p className="text-gray-600">Find projects and get paid securely with milestone-based payments</p>
              </div>
            </ExpandableScreenTrigger>

            <ExpandableScreenContent className="bg-gradient-to-br from-blue-500 to-blue-600">
              <div className="flex flex-col items-center justify-center h-full text-white p-12 text-center space-y-6">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Briefcase className="w-12 h-12" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-3xl md:text-4xl font-bold">Freelancer Dashboard</h2>
                  <ul className="space-y-3 text-lg text-white/90">
                    <li>• Browse and apply to projects</li>
                    <li>• Submit milestone deliverables</li>
                    <li>• Receive protected payments</li>
                  </ul>
                </div>
                <button
                  onClick={() => handleRoleSelect("freelancer")}
                  className="mt-8 px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-gray-50 transition-colors"
                >
                  Continue as Freelancer
                </button>
              </div>
            </ExpandableScreenContent>
          </ExpandableScreen>
        </div>
      </div>
    </div>
  );
}
