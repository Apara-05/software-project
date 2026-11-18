import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
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
  Student,
  Subject,
  UserProfile,
  UserRole,
} from '../types';

export function sanitizeId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }

    const isBootAdmin =
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
      user.emailVerified;
    const role: UserRole = isBootAdmin ? 'admin' : 'student';
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || `${user.uid}@campus.local`,
      displayName: (user.displayName || user.email?.split('@')[0] || 'Campus User').slice(0, 120),
      role,
      department: 'CSE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, profile);
    return { ...profile, role };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    await updateDoc(userRef, {
      role,
      updatedAt: serverTimestamp(),
    });
    if (role === 'admin' && snap.exists()) {
      const userData = snap.data() as UserProfile;
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email: userData.email,
        addedBy: uid,
        createdAt: serverTimestamp(),
      });
    } else if (role !== 'admin') {
      try {
        await deleteDoc(doc(db, 'admins', uid));
      } catch {
        // Admin doc may not exist
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function registerStudentWithFace(params: {
  studentId?: string;
  userId: string;
  name: string;
  rollNumber: string;
  email: string;
  department: string;
  semester: string;
  biometricConsent: boolean;
  descriptor: number[] | null;
  sampleCount: number;
  isSample?: boolean;
}): Promise<{ student: Student; faceRecord: FaceDescriptorRecord | null }> {
  const cleanRoll = sanitizeId(params.rollNumber.toUpperCase());
  const studentId = params.studentId ? sanitizeId(params.studentId) : `stu_${cleanRoll.toLowerCase()}`;
  const faceRegistered = Boolean(params.descriptor && params.descriptor.length === 128 && params.biometricConsent);
  const consentTimestamp = params.biometricConsent ? new Date().toISOString() : '';

  const studentPayload: Student = {
    id: studentId,
    userId: params.userId,
    name: params.name.trim().slice(0, 120),
    rollNumber: cleanRoll.slice(0, 40),
    email: params.email.trim().slice(0, 200),
    department: params.department.trim().slice(0, 80),
    semester: params.semester.trim().slice(0, 30),
    biometricConsent: params.biometricConsent,
    consentTimestamp,
    faceRegistered,
    isSample: Boolean(params.isSample),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(doc(db, 'students', studentId));
    if (existingSnap.exists()) {
      await updateDoc(doc(db, 'students', studentId), {
        name: studentPayload.name,
        rollNumber: studentPayload.rollNumber,
        email: studentPayload.email,
        department: studentPayload.department,
        semester: studentPayload.semester,
        biometricConsent: studentPayload.biometricConsent,
        consentTimestamp: studentPayload.consentTimestamp,
        faceRegistered: studentPayload.faceRegistered,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'students', studentId), studentPayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${studentId}`);
  }

  let faceRecord: FaceDescriptorRecord | null = null;
  if (faceRegistered && params.descriptor) {
    faceRecord = {
      studentId,
      userId: params.userId,
      studentName: studentPayload.name,
      rollNumber: studentPayload.rollNumber,
      department: studentPayload.department,
      semester: studentPayload.semester,
      descriptor: params.descriptor,
      sampleCount: Math.max(1, Math.min(20, params.sampleCount)),
      biometricConsent: true,
      isSample: Boolean(params.isSample),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const existingFace = await getDoc(doc(db, 'faceDescriptors', studentId));
      if (existingFace.exists()) {
        await updateDoc(doc(db, 'faceDescriptors', studentId), {
          descriptor: faceRecord.descriptor,
          sampleCount: faceRecord.sampleCount,
          biometricConsent: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'faceDescriptors', studentId), faceRecord);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `faceDescriptors/${studentId}`);
    }
  }

  return { student: studentPayload, faceRecord };
}

export async function deleteStudentRecord(studentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'faceDescriptors', studentId));
  } catch {
    // Descriptor may not exist if student had not enrolled face
  }
  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
  }
}

export async function saveFacultyMember(params: {
  createdBy: string;
  name: string;
  email: string;
  department: string;
  designation: string;
}): Promise<FacultyMember> {
  const id = `fac_${sanitizeId(params.email.split('@')[0])}_${Date.now().toString(36)}`;
  const payload: FacultyMember = {
    id,
    createdBy: params.createdBy,
    name: params.name.trim().slice(0, 120),
    email: params.email.trim().slice(0, 200),
    department: params.department.trim().slice(0, 80),
    designation: params.designation.trim().slice(0, 80),
    isSample: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'faculty', id), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `faculty/${id}`);
  }
}

export async function deleteFacultyMember(facultyId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'faculty', facultyId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `faculty/${facultyId}`);
  }
}

export async function saveSubject(params: {
  createdBy: string;
  code: string;
  name: string;
  department: string;
  semester: string;
  facultyName: string;
}): Promise<Subject> {
  const id = `sub_${sanitizeId(params.code.toLowerCase())}_${Date.now().toString(36)}`;
  const payload: Subject = {
    id,
    code: params.code.trim().toUpperCase().slice(0, 24),
    name: params.name.trim().slice(0, 120),
    department: params.department.trim().slice(0, 80),
    semester: params.semester.trim().slice(0, 30),
    facultyName: params.facultyName.trim().slice(0, 120),
    createdBy: params.createdBy,
    catalogScope: 'institution',
    isSample: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'subjects', id), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `subjects/${id}`);
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `subjects/${subjectId}`);
  }
}

export async function createAttendanceSession(params: {
  facultyUid: string;
  facultyName: string;
  subject: Subject;
  date: string;
  threshold: number;
}): Promise<AttendanceSession> {
  const id = `sess_${sanitizeId(params.subject.id)}_${Date.now().toString(36)}`;
  const payload: AttendanceSession = {
    id,
    facultyUid: params.facultyUid,
    facultyName: params.facultyName.slice(0, 120),
    subjectId: params.subject.id,
    subjectCode: params.subject.code,
    subjectName: params.subject.name,
    department: params.subject.department,
    semester: params.subject.semester,
    date: params.date,
    threshold: params.threshold,
    status: 'active',
    recognizedCount: 0,
    isSample: false,
    startedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'sessions', id), payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `sessions/${id}`);
  }
}

export async function completeAttendanceSession(sessionId: string, recognizedCount: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'completed',
      recognizedCount,
      endedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function updateSessionRecognizedCount(sessionId: string, recognizedCount: number): Promise<void> {
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      recognizedCount,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
  }
}

export async function markStudentAttendance(params: {
  student: Student | FaceDescriptorRecord;
  subject: Subject;
  facultyUid: string;
  facultyName: string;
  date: string;
  status: AttendanceStatus;
  confidenceDistance: number;
  thresholdUsed: number;
  verificationMethod: 'face_recognition' | 'manual_demo';
}): Promise<{ created: boolean; record: AttendanceRecord }> {
  const studentId = 'studentId' in params.student ? params.student.studentId : params.student.id;
  const studentName = 'studentName' in params.student ? params.student.studentName : params.student.name;
  const recordId = sanitizeId(`${studentId}_${params.subject.id}_${params.date}`);

  const ref = doc(db, 'attendance', recordId);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      return {
        created: false,
        record: existing.data() as AttendanceRecord,
      };
    }

    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    const payload: AttendanceRecord = {
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
      facultyUid: params.facultyUid,
      facultyName: params.facultyName.slice(0, 120),
      date: params.date,
      time,
      status: params.status,
      confidenceDistance: Number(params.confidenceDistance.toFixed(4)),
      thresholdUsed: Number(params.thresholdUsed.toFixed(2)),
      verificationMethod: params.verificationMethod,
      isSample: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    return { created: true, record: payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `attendance/${recordId}`);
  }
}

export async function seedSampleDataset(adminUid: string): Promise<void> {
  const faculty = buildSampleFaculty(adminUid);
  const subjects = buildSampleSubjects(adminUid);
  const students = buildSampleStudents(adminUid);
  const attendance = buildSampleAttendance(adminUid);
  const sessions = buildSampleSessions(adminUid);

  try {
    // Batch 1: Parent collections (faculty, subjects, students) must commit first
    const parentBatch = writeBatch(db);

    for (const fac of faculty) {
      parentBatch.set(doc(db, 'faculty', fac.id), {
        ...fac,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const sub of subjects) {
      parentBatch.set(doc(db, 'subjects', sub.id), {
        ...sub,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const stu of students) {
      parentBatch.set(doc(db, 'students', stu.id), {
        ...stu,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await parentBatch.commit();

    // Batch 2: Dependent collections (attendance, sessions) referencing committed students & subjects
    const childBatch = writeBatch(db);

    for (const rec of attendance) {
      childBatch.set(doc(db, 'attendance', rec.id), {
        ...rec,
        createdAt: serverTimestamp(),
      });
    }
    for (const sess of sessions) {
      childBatch.set(doc(db, 'sessions', sess.id), {
        ...sess,
        startedAt: serverTimestamp(),
        endedAt: serverTimestamp(),
      });
    }

    await childBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch_seed_sample_data');
  }
}

export async function clearSampleDataset(): Promise<void> {
  const collectionsToClean = ['attendance', 'sessions', 'students', 'subjects', 'faculty'];
  try {
    for (const colName of collectionsToClean) {
      const snap = await getDocs(query(collection(db, colName), where('isSample', '==', true)));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'clear_sample_data');
  }
}
