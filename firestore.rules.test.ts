/**
 * Security Rule Verification Matrix for Smart Attendance Management System.
 * Documents the 12 adversarial ("Dirty Dozen") payload assertions against DRAFT_firestore.rules.
 */

export interface SecurityTestCase {
  id: string;
  title: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  rationale: string;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Privilege Escalation on User Signup',
    collection: 'users',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-admin user creating /users/{uid} with role="admin" is rejected by role == "student" check.',
  },
  {
    id: 'DD-02',
    title: 'Role Mutation on User Update',
    collection: 'users',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'Owner update is constrained to affectedKeys().hasOnly(["displayName", "department", "updatedAt"]).',
  },
  {
    id: 'DD-03',
    title: 'Unverified Email Spoofing',
    collection: 'users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    rationale: 'isSignedIn() requires request.auth.token.email_verified == true.',
  },
  {
    id: 'DD-04',
    title: 'Shadow Field Injection on Student',
    collection: 'students',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidStudent() enforces strict keys().hasOnly(...) allowlist.',
  },
  {
    id: 'DD-05',
    title: 'Oversized Document ID Poisoning',
    collection: 'students',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidId() enforces id.size() <= 128 and regex ^[a-zA-Z0-9_\\-]+$.',
  },
  {
    id: 'DD-06',
    title: 'Biometric Descriptor Without Consent',
    collection: 'faceDescriptors',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidFaceDescriptor() mandates biometricConsent == true.',
  },
  {
    id: 'DD-07',
    title: 'Malformed Face Descriptor Array',
    collection: 'faceDescriptors',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'isValidFaceDescriptor() mandates descriptor is list, size == 128, descriptor[0] is number.',
  },
  {
    id: 'DD-08',
    title: 'Orphan Attendance Record',
    collection: 'attendance',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'attendance create requires exists() for both studentId and subjectId.',
  },
  {
    id: 'DD-09',
    title: 'Student Forging Attendance Record',
    collection: 'attendance',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'attendance create requires isFaculty() and facultyUid == request.auth.uid.',
  },
  {
    id: 'DD-10',
    title: 'Client Timestamp Forgery',
    collection: 'attendance',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    rationale: 'incoming().createdAt == request.time blocks forged timestamps.',
  },
  {
    id: 'DD-11',
    title: 'Reopening Completed Session',
    collection: 'sessions',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    rationale: 'existing().status != "completed" prevents non-admin mutation after completion.',
  },
  {
    id: 'DD-12',
    title: 'Cross-User PII Read',
    collection: 'users',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    rationale: 'Non-admin reading another user profile fails request.auth.uid == userId.',
  },
];
