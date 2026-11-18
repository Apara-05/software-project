import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import {
  completeAttendanceSession,
  createAttendanceSession,
  deleteFacultyMember,
  deleteStudentRecord,
  deleteSubject,
  ensureUserProfile,
  markStudentAttendance,
  registerStudentWithFace,
  saveFacultyMember,
  saveSubject,
  seedSampleDataset,
  clearSampleDataset,
  updateSessionRecognizedCount,
  updateUserRole,
} from '../lib/attendanceService';
import {
  buildSampleAttendance,
  buildSampleFaculty,
  buildSampleSessions,
  buildSampleStudents,
  buildSampleSubjects,
} from '../data/sampleData';
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  FaceDescriptorRecord,
  FacultyMember,
  PortalView,
  Student,
  Subject,
  UserProfile,
  UserRole,
} from '../types';

interface AppContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authReady: boolean;
  isSandboxMode: boolean;
  activePortal: PortalView;
  setActivePortal: (portal: PortalView) => void;
  loginWithGoogle: () => Promise<void>;
  enterSandboxDemo: (portal: PortalView) => void;
  logout: () => Promise<void>;
  authError: string | null;
  dataLoading: boolean;
  students: Student[];
  faculty: FacultyMember[];
  subjects: Subject[];
  faceDescriptors: FaceDescriptorRecord[];
  attendanceRecords: AttendanceRecord[];
  sessions: AttendanceSession[];
  usersList: UserProfile[];
  actionBusy: boolean;
  registerStudent: (params: {
    name: string;
    rollNumber: string;
    email: string;
    department: string;
    semester: string;
    biometricConsent: boolean;
    descriptor: number[] | null;
    sampleCount: number;
  }) => Promise<Student>;
  removeStudent: (studentId: string) => Promise<void>;
  addFaculty: (params: { name: string; email: string; department: string; designation: string }) => Promise<void>;
  removeFaculty: (facultyId: string) => Promise<void>;
  addSubject: (params: { code: string; name: string; department: string; semester: string; facultyName: string }) => Promise<void>;
  removeSubject: (subjectId: string) => Promise<void>;
  startSession: (subject: Subject, date: string, threshold: number) => Promise<AttendanceSession>;
  endSession: (sessionId: string, recognizedCount: number) => Promise<void>;
  bumpSessionCount: (sessionId: string, recognizedCount: number) => Promise<void>;
  recordAttendance: (params: {
    student: Student | FaceDescriptorRecord;
    subject: Subject;
    date: string;
    status: AttendanceStatus;
    confidenceDistance: number;
    thresholdUsed: number;
    verificationMethod: 'face_recognition' | 'manual_demo';
  }) => Promise<{ created: boolean; record: AttendanceRecord }>;
  seedSampleData: () => Promise<void>;
  clearSampleData: () => Promise<void>;
  changeUserRole: (uid: string, role: UserRole) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const [activePortal, setActivePortal] = useState<PortalView>('admin');
  const [authError, setAuthError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faceDescriptors, setFaceDescriptors] = useState<FaceDescriptorRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  const autoSeededRef = useRef(false);

  useEffect(() => {
    testConnection();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      setIsSandboxMode(false);
      setAuthError(null);
      try {
        const profile = await ensureUserProfile(user);
        setUserProfile(profile);
        setActivePortal(profile.role);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Failed to load user profile');
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // Firestore real-time subscriptions (only when authenticated)
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) return;

    setDataLoading(true);
    const isBootAdmin =
      firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
      firebaseUser.emailVerified;

    const unsubscribers: Array<() => void> = [];

    if (isBootAdmin) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'students'),
          (snap) => {
            setStudents(snap.docs.map((d) => d.data() as Student));
            setDataLoading(false);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'students'),
        ),
        onSnapshot(
          collection(db, 'faculty'),
          (snap) => setFaculty(snap.docs.map((d) => d.data() as FacultyMember)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'faculty'),
        ),
        onSnapshot(
          collection(db, 'subjects'),
          async (snap) => {
            const list = snap.docs.map((d) => d.data() as Subject);
            setSubjects(list);
            if (list.length === 0 && !autoSeededRef.current) {
              autoSeededRef.current = true;
              try {
                await seedSampleDataset(firebaseUser.uid);
              } catch (seedErr) {
                console.error('Auto-seed sample data failed:', seedErr);
              }
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'),
        ),
        onSnapshot(
          collection(db, 'faceDescriptors'),
          (snap) => setFaceDescriptors(snap.docs.map((d) => d.data() as FaceDescriptorRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'faceDescriptors'),
        ),
        onSnapshot(
          collection(db, 'attendance'),
          (snap) => setAttendanceRecords(snap.docs.map((d) => d.data() as AttendanceRecord)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'),
        ),
        onSnapshot(
          collection(db, 'sessions'),
          (snap) => setSessions(snap.docs.map((d) => d.data() as AttendanceSession)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'),
        ),
        onSnapshot(
          collection(db, 'users'),
          (snap) => setUsersList(snap.docs.map((d) => d.data() as UserProfile)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
        ),
      );
    } else {
      // Non-admin verified user: scope queries cleanly to allowed resource predicates
      const uid = firebaseUser.uid;
      let ownStudents: Student[] = [];
      let sampleStudents: Student[] = [];
      let ownFaces: FaceDescriptorRecord[] = [];
      let sampleFaces: FaceDescriptorRecord[] = [];
      let ownAtt: AttendanceRecord[] = [];
      let facultyAtt: AttendanceRecord[] = [];
      let sampleAtt: AttendanceRecord[] = [];
      let facultySessions: AttendanceSession[] = [];
      let sampleSessions: AttendanceSession[] = [];

      const mergeById = <T extends { id?: string; studentId?: string }>(a: T[], b: T[]): T[] => {
        const map = new Map<string, T>();
        [...a, ...b].forEach((item) => {
          const key = item.id || item.studentId || '';
          if (key) map.set(key, item);
        });
        return Array.from(map.values());
      };

      const mergeThree = <T extends { id?: string; studentId?: string }>(a: T[], b: T[], c: T[]): T[] => {
        return mergeById(mergeById(a, b), c);
      };

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'students'), where('userId', '==', uid)),
          (snap) => {
            ownStudents = snap.docs.map((d) => d.data() as Student);
            setStudents(mergeById(ownStudents, sampleStudents));
            setDataLoading(false);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'students/own'),
        ),
        onSnapshot(
          query(collection(db, 'students'), where('isSample', '==', true)),
          (snap) => {
            sampleStudents = snap.docs.map((d) => d.data() as Student);
            setStudents(mergeById(ownStudents, sampleStudents));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'students/sample'),
        ),
        onSnapshot(
          query(collection(db, 'faceDescriptors'), where('userId', '==', uid)),
          (snap) => {
            ownFaces = snap.docs.map((d) => d.data() as FaceDescriptorRecord);
            setFaceDescriptors(mergeById(ownFaces, sampleFaces));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'faceDescriptors/own'),
        ),
        onSnapshot(
          query(collection(db, 'faceDescriptors'), where('isSample', '==', true)),
          (snap) => {
            sampleFaces = snap.docs.map((d) => d.data() as FaceDescriptorRecord);
            setFaceDescriptors(mergeById(ownFaces, sampleFaces));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'faceDescriptors/sample'),
        ),
        onSnapshot(
          query(collection(db, 'subjects'), where('catalogScope', '==', 'institution')),
          (snap) => setSubjects(snap.docs.map((d) => d.data() as Subject)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'subjects'),
        ),
        onSnapshot(
          query(collection(db, 'faculty'), where('isSample', '==', true)),
          (snap) => setFaculty(snap.docs.map((d) => d.data() as FacultyMember)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'faculty'),
        ),
        onSnapshot(
          query(collection(db, 'attendance'), where('studentUserId', '==', uid)),
          (snap) => {
            ownAtt = snap.docs.map((d) => d.data() as AttendanceRecord);
            setAttendanceRecords(mergeThree(ownAtt, facultyAtt, sampleAtt));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance/own'),
        ),
        onSnapshot(
          query(collection(db, 'attendance'), where('facultyUid', '==', uid)),
          (snap) => {
            facultyAtt = snap.docs.map((d) => d.data() as AttendanceRecord);
            setAttendanceRecords(mergeThree(ownAtt, facultyAtt, sampleAtt));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance/faculty'),
        ),
        onSnapshot(
          query(collection(db, 'attendance'), where('isSample', '==', true)),
          (snap) => {
            sampleAtt = snap.docs.map((d) => d.data() as AttendanceRecord);
            setAttendanceRecords(mergeThree(ownAtt, facultyAtt, sampleAtt));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'attendance/sample'),
        ),
        onSnapshot(
          query(collection(db, 'sessions'), where('facultyUid', '==', uid)),
          (snap) => {
            facultySessions = snap.docs.map((d) => d.data() as AttendanceSession);
            setSessions(mergeById(facultySessions, sampleSessions));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'sessions/faculty'),
        ),
        onSnapshot(
          query(collection(db, 'sessions'), where('isSample', '==', true)),
          (snap) => {
            sampleSessions = snap.docs.map((d) => d.data() as AttendanceSession);
            setSessions(mergeById(facultySessions, sampleSessions));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'sessions/sample'),
        ),
      );
    }

    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  }, [authReady, firebaseUser, userProfile]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setAuthError(message);
    }
  };

  const enterSandboxDemo = (portal: PortalView) => {
    setAuthError(null);
    setIsSandboxMode(true);
    setActivePortal(portal);
    const demoUid = 'sandbox_demo_user';
    setFaculty(buildSampleFaculty(demoUid));
    setSubjects(buildSampleSubjects(demoUid));
    setStudents(buildSampleStudents(demoUid));
    setAttendanceRecords(buildSampleAttendance(demoUid));
    setSessions(buildSampleSessions(demoUid));
    setFaceDescriptors([]);
  };

  const logout = async () => {
    if (isSandboxMode) {
      setIsSandboxMode(false);
      setStudents([]);
      setFaculty([]);
      setSubjects([]);
      setFaceDescriptors([]);
      setAttendanceRecords([]);
      setSessions([]);
      return;
    }
    await signOut(auth);
  };

  const registerStudent: AppContextValue['registerStudent'] = async (params) => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        const cleanRoll = params.rollNumber.trim().toUpperCase().replace(/[^a-zA-Z0-9_-]/g, '_');
        const id = `stu_${cleanRoll.toLowerCase()}`;
        const faceRegistered = Boolean(params.descriptor && params.descriptor.length === 128 && params.biometricConsent);
        const student: Student = {
          id,
          userId: 'sandbox_demo_user',
          name: params.name.trim(),
          rollNumber: cleanRoll,
          email: params.email.trim(),
          department: params.department,
          semester: params.semester,
          biometricConsent: params.biometricConsent,
          consentTimestamp: params.biometricConsent ? new Date().toISOString() : '',
          faceRegistered,
          isSample: false,
        };
        setStudents((prev) => [student, ...prev.filter((s) => s.id !== id)]);
        if (faceRegistered && params.descriptor) {
          const faceRec: FaceDescriptorRecord = {
            studentId: id,
            userId: 'sandbox_demo_user',
            studentName: student.name,
            rollNumber: student.rollNumber,
            department: student.department,
            semester: student.semester,
            descriptor: params.descriptor,
            sampleCount: params.sampleCount,
            biometricConsent: true,
            isSample: false,
          };
          setFaceDescriptors((prev) => [faceRec, ...prev.filter((f) => f.studentId !== id)]);
        }
        return student;
      }

      const result = await registerStudentWithFace({
        ...params,
        userId: firebaseUser.uid,
        isSample: false,
      });
      return result.student;
    } finally {
      setActionBusy(false);
    }
  };

  const removeStudent = async (studentId: string) => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        setFaceDescriptors((prev) => prev.filter((f) => f.studentId !== studentId));
        return;
      }
      await deleteStudentRecord(studentId);
    } finally {
      setActionBusy(false);
    }
  };

  const addFaculty: AppContextValue['addFaculty'] = async (params) => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        const fac: FacultyMember = {
          id: `fac_${Date.now().toString(36)}`,
          createdBy: 'sandbox_demo_user',
          ...params,
          isSample: false,
        };
        setFaculty((prev) => [fac, ...prev]);
        return;
      }
      await saveFacultyMember({ createdBy: firebaseUser.uid, ...params });
    } finally {
      setActionBusy(false);
    }
  };

  const removeFaculty = async (facultyId: string) => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        setFaculty((prev) => prev.filter((f) => f.id !== facultyId));
        return;
      }
      await deleteFacultyMember(facultyId);
    } finally {
      setActionBusy(false);
    }
  };

  const addSubject: AppContextValue['addSubject'] = async (params) => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        const sub: Subject = {
          id: `sub_${Date.now().toString(36)}`,
          ...params,
          createdBy: 'sandbox_demo_user',
          catalogScope: 'institution',
          isSample: false,
        };
        setSubjects((prev) => [sub, ...prev]);
        return;
      }
      await saveSubject({ createdBy: firebaseUser.uid, ...params });
    } finally {
      setActionBusy(false);
    }
  };

  const removeSubject = async (subjectId: string) => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
        return;
      }
      await deleteSubject(subjectId);
    } finally {
      setActionBusy(false);
    }
  };

  const startSession: AppContextValue['startSession'] = async (subject, date, threshold) => {
    if (isSandboxMode || !firebaseUser) {
      const sess: AttendanceSession = {
        id: `sess_${Date.now().toString(36)}`,
        facultyUid: 'sandbox_demo_user',
        facultyName: subject.facultyName,
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        department: subject.department,
        semester: subject.semester,
        date,
        threshold,
        status: 'active',
        recognizedCount: 0,
        isSample: false,
      };
      setSessions((prev) => [sess, ...prev]);
      return sess;
    }

    return createAttendanceSession({
      facultyUid: firebaseUser.uid,
      facultyName: userProfile?.displayName || subject.facultyName,
      subject,
      date,
      threshold,
    });
  };

  const endSession = async (sessionId: string, recognizedCount: number) => {
    if (isSandboxMode || !firebaseUser) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'completed', recognizedCount } : s,
        ),
      );
      return;
    }
    await completeAttendanceSession(sessionId, recognizedCount);
  };

  const bumpSessionCount = async (sessionId: string, recognizedCount: number) => {
    if (isSandboxMode || !firebaseUser) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, recognizedCount } : s)),
      );
      return;
    }
    await updateSessionRecognizedCount(sessionId, recognizedCount);
  };

  const recordAttendance: AppContextValue['recordAttendance'] = async (params) => {
    const studentId = 'studentId' in params.student ? params.student.studentId : params.student.id;
    const studentName = 'studentName' in params.student ? params.student.studentName : params.student.name;
    const recordId = `${studentId}_${params.subject.id}_${params.date}`;

    if (isSandboxMode || !firebaseUser) {
      const existing = attendanceRecords.find((r) => r.id === recordId);
      if (existing) {
        return { created: false, record: existing };
      }
      const newRec: AttendanceRecord = {
        id: recordId,
        studentId,
        studentUserId: params.student.userId,
        studentName,
        rollNumber: params.student.rollNumber,
        department: params.student.department,
        semester: params.student.semester,
        subjectId: params.subject.id,
        subjectCode: params.subject.code,
        subjectName: params.subject.name,
        facultyUid: 'sandbox_demo_user',
        facultyName: params.subject.facultyName,
        date: params.date,
        time: new Date().toTimeString().slice(0, 8),
        status: params.status,
        confidenceDistance: params.confidenceDistance,
        thresholdUsed: params.thresholdUsed,
        verificationMethod: params.verificationMethod,
        isSample: false,
      };
      setAttendanceRecords((prev) => [newRec, ...prev]);
      return { created: true, record: newRec };
    }

    return markStudentAttendance({
      ...params,
      facultyUid: firebaseUser.uid,
      facultyName: userProfile?.displayName || params.subject.facultyName,
    });
  };

  const seedSampleData = async () => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        enterSandboxDemo(activePortal);
        return;
      }
      await seedSampleDataset(firebaseUser.uid);
    } finally {
      setActionBusy(false);
    }
  };

  const clearSampleData = async () => {
    setActionBusy(true);
    try {
      if (isSandboxMode || !firebaseUser) {
        setStudents((prev) => prev.filter((s) => !s.isSample));
        setFaculty((prev) => prev.filter((f) => !f.isSample));
        setSubjects((prev) => prev.filter((s) => !s.isSample));
        setAttendanceRecords((prev) => prev.filter((a) => !a.isSample));
        setSessions((prev) => prev.filter((s) => !s.isSample));
        return;
      }
      await clearSampleDataset();
    } finally {
      setActionBusy(false);
    }
  };

  const changeUserRole = async (uid: string, role: UserRole) => {
    if (isSandboxMode || !firebaseUser) return;
    await updateUserRole(uid, role);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      authReady,
      isSandboxMode,
      activePortal,
      setActivePortal,
      loginWithGoogle,
      enterSandboxDemo,
      logout,
      authError,
      dataLoading,
      students,
      faculty,
      subjects,
      faceDescriptors,
      attendanceRecords,
      sessions,
      usersList,
      actionBusy,
      registerStudent,
      removeStudent,
      addFaculty,
      removeFaculty,
      addSubject,
      removeSubject,
      startSession,
      endSession,
      bumpSessionCount,
      recordAttendance,
      seedSampleData,
      clearSampleData,
      changeUserRole,
    }),
    [
      firebaseUser,
      userProfile,
      authReady,
      isSandboxMode,
      activePortal,
      authError,
      dataLoading,
      students,
      faculty,
      subjects,
      faceDescriptors,
      attendanceRecords,
      sessions,
      usersList,
      actionBusy,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
