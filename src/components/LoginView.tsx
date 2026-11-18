import React from 'react';
import {
  Camera,
  CheckCircle2,
  Database,
  Lock,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { PortalView } from '../types';

export function LoginView() {
  const { loginWithGoogle, enterSandboxDemo, authError } = useApp();

  const demoRoles: Array<{
    portal: PortalView;
    title: string;
    subtitle: string;
    capabilities: string;
    icon: React.ReactNode;
  }> = [
    {
      portal: 'admin',
      title: 'Admin Demo Access',
      subtitle: 'Institutional Oversight',
      capabilities: 'View KPIs, manage students & faculty, seed sample data, export CSV reports.',
      icon: <Users className="w-5 h-5 text-[#1D4ED8]" />,
    },
    {
      portal: 'faculty',
      title: 'Faculty Demo Access',
      subtitle: 'Live Webcam Attendance',
      capabilities: 'Start class session, run face-api.js matching, auto-mark attendance.',
      icon: <Camera className="w-5 h-5 text-[#1D4ED8]" />,
    },
    {
      portal: 'student',
      title: 'Student Demo Access',
      subtitle: 'Biometric Enrollment & History',
      capabilities: 'Register profile, capture 128-d face descriptor, inspect attendance %.',
      icon: <UserCheck className="w-5 h-5 text-[#1D4ED8]" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
        <div className="text-lg font-bold tracking-tight text-[#0F1E3D] whitespace-nowrap shrink-0">
          Smart Attendance System
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
          <span>B.Tech Computer Science Project</span>
          <span aria-hidden="true">·</span>
          <span>Firebase Auth & Firestore</span>
          <span aria-hidden="true">·</span>
          <span>face-api.js Biometric Engine</span>
        </div>
        <button
          type="button"
          onClick={loginWithGoogle}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#0F1E3D] rounded-lg hover:bg-[#1A3160] transition-colors whitespace-nowrap shrink-0"
        >
          Sign in with Google
        </button>
      </header>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: System Overview */}
        <section className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#1D4ED8]">
              Biometric Classroom Attendance Platform
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-[#0F1E3D] leading-tight [text-wrap:balance]">
              Smart Attendance Management System Using Face Recognition
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Browser-based facial recognition powered by 128-dimensional neural embeddings, paired with Firebase Authentication, Cloud Firestore persistence, and role-based analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2.5 text-[#0F1E3D] font-semibold text-sm">
                <Camera className="w-4 h-4 text-[#2563EB]" />
                <span>Real face-api.js Inference</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Extracts 68 facial landmarks and 128-d descriptors locally in your browser using TinyFaceDetector and ResNet-34 weights.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2.5 text-[#0F1E3D] font-semibold text-sm">
                <Database className="w-4 h-4 text-[#2563EB]" />
                <span>Deduplicated Firestore Sync</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Enforces deterministic record IDs per student, subject, and date to eliminate duplicate attendance entries.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2.5 text-[#0F1E3D] font-semibold text-sm">
                <Lock className="w-4 h-4 text-[#2563EB]" />
                <span>Role-Based Security Rules</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Isolates PII, enforces explicit biometric consent prior to capture, and validates schema boundaries in Firestore rules.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2.5 text-[#0F1E3D] font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                <span>Reports & CSV Export</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Generates daily, subject-wise, and student-wise percentage reports with strict separation of sample and live attendance.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">Academic Demonstration Notice:</span> This system performs Euclidean distance matching on webcam frames via face-api.js for B.Tech project demonstration. It does not implement hardware depth sensing, infrared liveness checks, or anti-spoofing protection.
            </div>
          </div>
        </section>

        {/* Right: Authentication & Demo Access */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[#0F1E3D]">Sign In to Workspace</h2>
            <p className="text-sm text-slate-600">
              Authenticate with Google for live Cloud Firestore persistence, or launch a role preview with sample data.
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full py-3 px-4 bg-[#0F1E3D] hover:bg-[#19305E] text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
              />
            </svg>
            Continue with Google (Live Firestore)
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-xs font-medium text-slate-400">
              Or Explore Instant Role Demo
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <div className="space-y-2.5">
            {demoRoles.map((item) => (
              <button
                key={item.portal}
                type="button"
                onClick={() => enterSandboxDemo(item.portal)}
                className="w-full text-left p-3.5 rounded-lg border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/50 transition-colors flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-blue-50 shrink-0">{item.icon}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span>{item.title}</span>
                    <span className="text-xs font-normal text-slate-400">·</span>
                    <span className="text-xs font-medium text-[#1D4ED8]">{item.subtitle}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {item.capabilities}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
