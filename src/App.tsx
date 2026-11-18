import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { SidebarLayout, type NavSection } from './components/SidebarLayout';
import { AdminOverview } from './components/AdminOverview';
import { AdminDirectory } from './components/AdminDirectory';
import { ReportsView } from './components/ReportsView';
import { FacultyLiveAttendance } from './components/FacultyLiveAttendance';
import { StudentPortal } from './components/StudentPortal';

function MainWorkspace() {
  const { authReady, firebaseUser, isSandboxMode, activePortal } = useApp();
  const [activeSection, setActiveSection] = useState<NavSection>('overview');

  useEffect(() => {
    if (activePortal === 'admin') setActiveSection('overview');
    if (activePortal === 'faculty') setActiveSection('live-attendance');
    if (activePortal === 'student') setActiveSection('student-enroll');
  }, [activePortal]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-8 py-6 text-center space-y-2">
          <div className="text-sm font-semibold text-[#0F1E3D]">
            Initializing Smart Attendance System
          </div>
          <div className="text-xs text-slate-500">
            Verifying Firebase Authentication and Cloud Firestore session...
          </div>
        </div>
      </div>
    );
  }

  if (!firebaseUser && !isSandboxMode) {
    return <LoginView />;
  }

  return (
    <SidebarLayout activeSection={activeSection} onSelectSection={setActiveSection}>
      {activeSection === 'overview' && <AdminOverview />}
      {activeSection === 'directory' && (
        <AdminDirectory onEnrollNewStudent={() => setActiveSection('student-enroll')} />
      )}
      {activeSection === 'reports' && <ReportsView />}
      {activeSection === 'live-attendance' && <FacultyLiveAttendance initialView="live" />}
      {activeSection === 'faculty-history' && <FacultyLiveAttendance initialView="history" />}
      {activeSection === 'student-enroll' && <StudentPortal initialTab="enroll" />}
      {activeSection === 'student-history' && <StudentPortal initialTab="history" />}
    </SidebarLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainWorkspace />
      </AppProvider>
    </ErrorBoundary>
  );
}
