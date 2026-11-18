export type UserRole = 'admin' | 'faculty' | 'student';

export type PortalView = 'admin' | 'faculty' | 'student';

export type DataSourceFilter = 'all' | 'live' | 'sample';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FacultyMember {
  id: string;
  createdBy: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  isSample: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  rollNumber: string;
  email: string;
  department: string;
  semester: string;
  biometricConsent: boolean;
  consentTimestamp?: string;
  faceRegistered: boolean;
  isSample: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FaceDescriptorRecord {
  studentId: string;
  userId: string;
  studentName: string;
  rollNumber: string;
  department: string;
  semester: string;
  descriptor: number[];
  sampleCount: number;
  biometricConsent: boolean;
  isSample: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  department: string;
  semester: string;
  facultyName: string;
  createdBy: string;
  catalogScope?: string;
  isSample: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AttendanceStatus = 'Present' | 'Late' | 'Absent';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentUserId: string;
  studentName: string;
  rollNumber: string;
  department: string;
  semester: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  facultyUid: string;
  facultyName: string;
  date: string;
  time: string;
  status: AttendanceStatus;
  confidenceDistance: number;
  thresholdUsed: number;
  verificationMethod: 'face_recognition' | 'manual_demo';
  isSample: boolean;
  createdAt?: unknown;
}

export interface AttendanceSession {
  id: string;
  facultyUid: string;
  facultyName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  department: string;
  semester: string;
  date: string;
  threshold: number;
  status: 'active' | 'completed';
  recognizedCount: number;
  isSample: boolean;
  startedAt?: unknown;
  endedAt?: unknown;
}

export interface RecognitionEvent {
  id: string;
  timestamp: string;
  type: 'matched' | 'duplicate' | 'unknown' | 'error';
  studentName?: string;
  rollNumber?: string;
  distance?: number;
  message: string;
}
