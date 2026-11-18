# Security Specification & Threat Model

## 1. Data Invariants
1. **Privilege Escalation Prevention**: A non-admin user creating `/users/{uid}` cannot assign `role: 'admin'` or `role: 'faculty'`. Only `'student'` is permitted on self-registration unless the user is the verified bootstrapped admin (`budhkarapara@gmail.com`).
2. **Biometric Consent Gate**: A `FaceDescriptor` document cannot be created or updated unless `biometricConsent == true` and `descriptor.size() == 128` with numeric elements.
3. **Referential Integrity & Deduplication**: An `AttendanceRecord` must reference an existing `Student` (`exists(/databases/$(database)/documents/students/$(incoming().studentId))`) and an existing `Subject` (`exists(/databases/$(database)/documents/subjects/$(incoming().subjectId))`), and its document ID enforces uniqueness per `(studentId, subjectId, date)`.
4. **Terminal State Locking**: Once an `AttendanceSession` transitions to `status == 'completed'`, non-admin users cannot reopen or mutate it.
5. **PII Isolation**: User profiles (`/users/{uid}` containing `email`) are readable only by the owner or an admin. List queries on `/students` and `/attendance` enforce ownership (`resource.data.userId == request.auth.uid`), faculty attribution (`resource.data.facultyUid == request.auth.uid`), sample flag (`resource.data.isSample == true`), or bootstrapped admin identity without `get()`/`exists()` inside `allow list`.
6. **Temporal Integrity**: All `createdAt`, `updatedAt`, and `startedAt` fields must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Signup**: `POST /users/attackerUid` with `{ role: "admin" }` -> **DENIED**
2. **Role Mutation on Profile Update**: `PATCH /users/studentUid` with `{ role: "faculty" }` -> **DENIED**
3. **Unverified Email Spoofing**: Request with `email == "budhkarapara@gmail.com"` and `email_verified == false` -> **DENIED**
4. **Shadow Field Injection**: `POST /students/s1` including `{ isVerified: true }` -> **DENIED**
5. **Oversized ID Poisoning**: `PUT /students/<1500-char-id>` -> **DENIED**
6. **Biometric Descriptor Without Consent**: `POST /faceDescriptors/s1` with `{ biometricConsent: false }` -> **DENIED**
7. **Malformed Descriptor Vector**: `POST /faceDescriptors/s1` with `descriptor` length 5 or string element -> **DENIED**
8. **Orphan Attendance Record**: `POST /attendance/a1` referencing non-existent `studentId` or `subjectId` -> **DENIED**
9. **Spoofed Faculty Attendance Write**: Student attempts `POST /attendance/a1` with `facultyUid != request.auth.uid` -> **DENIED**
10. **Client Timestamp Forgery**: `POST /attendance/a1` with backdated `createdAt` (`!= request.time`) -> **DENIED**
11. **Terminal Session Reopen**: Non-admin `PATCH /sessions/sess1` changing `status: "completed"` back to `"active"` -> **DENIED**
12. **PII Blanket Read**: Student queries `GET /users/otherUserUid` -> **DENIED**
