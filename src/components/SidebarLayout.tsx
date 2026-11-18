import React from 'react';
import {
  BarChart3,
  Camera,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { PortalView } from '../types';

export type NavSection =
  | 'overview'
  | 'directory'
  | 'reports'
  | 'live-attendance'
  | 'faculty-history'
  | 'student-enroll'
  | 'student-history';

interface SidebarLayoutProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  children: React.ReactNode;
}

export function SidebarLayout({
  activeSection,
  onSelectSection,
  children,
}: SidebarLayoutProps) {
  const {
    userProfile,
    isSandboxMode,
    activePortal,
    setActivePortal,
    loginWithGoogle,
    logout,
  } = useApp();

  const canSwitchPortals =
    isSandboxMode || userProfile?.role === 'admin' || userProfile?.role === 'faculty';

  const handlePortalSwitch = (portal: PortalView) => {
    setActivePortal(portal);
    if (portal === 'admin') onSelectSection('overview');
    if (portal === 'faculty') onSelectSection('live-attendance');
    if (portal === 'student') onSelectSection('student-enroll');
  };

  const navItemsByPortal: Record<
    PortalView,
    Array<{ id: NavSection; label: string; icon: React.ReactNode }>
  > = {
    admin: [
      { id: 'overview', label: 'Dashboard Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
      { id: 'directory', label: 'Students & Faculty', icon: <Users className="w-4 h-4" /> },
      { id: 'reports', label: 'Attendance Reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
      { id: 'live-attendance', label: 'Webcam Recognition', icon: <Camera className="w-4 h-4" /> },
      { id: 'student-enroll', label: 'Enroll Student Face', icon: <UserPlus className="w-4 h-4" /> },
    ],
    faculty: [
      { id: 'live-attendance', label: 'Live Attendance', icon: <Camera className="w-4 h-4" /> },
      { id: 'faculty-history', label: 'Session History', icon: <BarChart3 className="w-4 h-4" /> },
      { id: 'reports', label: 'Export Reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
    ],
    student: [
      { id: 'student-enroll', label: 'Registration & Face', icon: <UserPlus className="w-4 h-4" /> },
      { id: 'student-history', label: 'My Attendance', icon: <GraduationCap className="w-4 h-4" /> },
    ],
  };

  const currentNav = navItemsByPortal[activePortal];

  const portalLabel =
    activePortal === 'admin'
      ? 'Admin Console'
      : activePortal === 'faculty'
        ? 'Faculty Portal'
        : 'Student Portal';

  const sectionLabel =
    currentNav.find((item) => item.id === activeSection)?.label || 'Workspace';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Navy Sidebar */}
      <aside className="w-full lg:w-64 bg-[#0F1E3D] text-white shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#1E335F]">
        <div>
          <div className="px-6 py-5 border-b border-white/10">
            <div className="text-base font-bold tracking-tight text-white whitespace-nowrap">
              Smart Attendance
            </div>
            <div className="text-xs text-blue-200/80 mt-0.5">
              Face Recognition System
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {currentNav.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs text-blue-100/90 space-y-0.5">
            <div className="font-semibold text-white truncate">
              {isSandboxMode ? 'Demo Sandbox User' : userProfile?.displayName || 'Authenticated User'}
            </div>
            <div className="text-blue-200/75 truncate">
              {isSandboxMode
                ? 'Local Sample Preview'
                : `${userProfile?.email || ''} · ${userProfile?.role || 'student'}`}
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-100 bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isSandboxMode ? 'Exit Demo Mode' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-500">{portalLabel}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-[#0F1E3D]">{sectionLabel}</span>
          </div>

          <div className="flex items-center gap-3">
            {canSwitchPortals && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['admin', 'faculty', 'student'] as PortalView[]).map((portal) => (
                  <button
                    key={portal}
                    type="button"
                    onClick={() => handlePortalSwitch(portal)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap capitalize ${
                      activePortal === portal
                        ? 'bg-white text-[#0F1E3D] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {portal}
                  </button>
                ))}
              </div>
            )}

            {isSandboxMode && (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </header>

        {/* Academic / Sandbox Banner */}
        <div className="bg-blue-50/70 border-b border-blue-100 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#1D4ED8] shrink-0" />
            <span>
              Academic Demonstration System: face-api.js performs client-side 128-d descriptor matching without hardware liveness or anti-spoofing protection.
            </span>
          </div>
          <span className="font-medium text-[#0F1E3D]">
            {isSandboxMode ? 'Storage: Local Sandbox Preview' : 'Storage: Cloud Firestore Live'}
          </span>
        </div>

        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
