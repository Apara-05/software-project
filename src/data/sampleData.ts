import type { AttendanceRecord, AttendanceSession, FacultyMember, Student, Subject } from '../types';

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getRecentDateStrings(days: number): string[] {
  const result: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push(formatIsoDate(d));
  }
  return result;
}

export function buildSampleFaculty(createdBy: string): FacultyMember[] {
  return [
    {
      id: 'fac_sample_1',
      createdBy,
      name: 'Dr. Rajesh Nair',
      email: 'rajesh.nair@college.edu',
      department: 'CSE',
      designation: 'Professor & HOD',
      isSample: true,
    },
    {
      id: 'fac_sample_2',
      createdBy,
      name: 'Prof. Ananya Kulkarni',
      email: 'ananya.kulkarni@college.edu',
      department: 'CSE',
      designation: 'Associate Professor',
      isSample: true,
    },
    {
      id: 'fac_sample_3',
      createdBy,
      name: 'Dr. Vikram Deshmukh',
      email: 'vikram.deshmukh@college.edu',
      department: 'ECE',
      designation: 'Assistant Professor',
      isSample: true,
    },
  ];
}

export function buildSampleSubjects(createdBy: string): Subject[] {
  return [
    {
      id: 'sub_cs601',
      code: 'CS601',
      name: 'Machine Learning',
      department: 'CSE',
      semester: 'Sem 6',
      facultyName: 'Dr. Rajesh Nair',
      createdBy,
      catalogScope: 'institution',
      isSample: true,
    },
    {
      id: 'sub_cs602',
      code: 'CS602',
      name: 'Distributed Systems',
      department: 'CSE',
      semester: 'Sem 6',
      facultyName: 'Prof. Ananya Kulkarni',
      createdBy,
      catalogScope: 'institution',
      isSample: true,
    },
    {
      id: 'sub_cs603',
      code: 'CS603',
      name: 'Computer Vision',
      department: 'CSE',
      semester: 'Sem 6',
      facultyName: 'Dr. Rajesh Nair',
      createdBy,
      catalogScope: 'institution',
      isSample: true,
    },
    {
      id: 'sub_cs604',
      code: 'CS604',
      name: 'Cloud Architecture',
      department: 'CSE',
      semester: 'Sem 6',
      facultyName: 'Prof. Ananya Kulkarni',
      createdBy,
      catalogScope: 'institution',
      isSample: true,
    },
    {
      id: 'sub_ec601',
      code: 'EC601',
      name: 'Embedded Systems',
      department: 'ECE',
      semester: 'Sem 6',
      facultyName: 'Dr. Vikram Deshmukh',
      createdBy,
      catalogScope: 'institution',
      isSample: true,
    },
  ];
}

export function buildSampleStudents(ownerUid: string): Student[] {
  const baseStudents = [
    { id: 'stu_sample_01', name: 'Aarav Sharma', rollNumber: 'BT23CSE001', email: 'aarav.sharma@student.edu', department: 'CSE', semester: 'Sem 6' },
    { id: 'stu_sample_02', name: 'Priya Menon', rollNumber: 'BT23CSE002', email: 'priya.menon@student.edu', department: 'CSE', semester: 'Sem 6' },
    { id: 'stu_sample_03', name: 'Rohan Verma', rollNumber: 'BT23CSE003', email: 'rohan.verma@student.edu', department: 'CSE', semester: 'Sem 6' },
    { id: 'stu_sample_04', name: 'Sneha Patil', rollNumber: 'BT23CSE004', email: 'sneha.patil@student.edu', department: 'CSE', semester: 'Sem 6' },
    { id: 'stu_sample_05', name: 'Karthik Iyer', rollNumber: 'BT23CSE005', email: 'karthik.iyer@student.edu', department: 'CSE', semester: 'Sem 6' },
    { id: 'stu_sample_06', name: 'Meera Joshi', rollNumber: 'BT23CSE006', email: 'meera.joshi@student.edu', department: 'CSE', semester: 'Sem 6' },
    { id: 'stu_sample_07', name: 'Arjun Reddy', rollNumber: 'BT23ECE001', email: 'arjun.reddy@student.edu', department: 'ECE', semester: 'Sem 6' },
    { id: 'stu_sample_08', name: 'Divya Krishnan', rollNumber: 'BT23ECE002', email: 'divya.krishnan@student.edu', department: 'ECE', semester: 'Sem 6' },
  ];

  return baseStudents.map((s) => ({
    ...s,
    userId: ownerUid,
    biometricConsent: false,
    faceRegistered: false,
    isSample: true,
  }));
}

export function buildSampleAttendance(ownerUid: string): AttendanceRecord[] {
  const students = buildSampleStudents(ownerUid);
  const subjects = buildSampleSubjects(ownerUid);
  const dates = getRecentDateStrings(7);
  const records: AttendanceRecord[] = [];

  dates.forEach((dateStr, dIdx) => {
    students.forEach((stu, sIdx) => {
      const deptSubjects = subjects.filter((sub) => sub.department === stu.department);
      const sub = deptSubjects[dIdx % deptSubjects.length];
      if (!sub) return;

      // Deterministic realistic attendance distribution (~82% Present, ~8% Late, ~10% Absent)
      const hash = (dIdx * 7 + sIdx * 3) % 10;
      const status = hash === 0 ? 'Absent' : hash === 9 ? 'Late' : 'Present';

      records.push({
        id: `${stu.id}_${sub.id}_${dateStr}`,
        studentId: stu.id,
        studentUserId: ownerUid,
        studentName: stu.name,
        rollNumber: stu.rollNumber,
        department: stu.department,
        semester: stu.semester,
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        facultyUid: ownerUid,
        facultyName: sub.facultyName,
        date: dateStr,
        time: status === 'Late' ? '09:18:40' : '09:04:12',
        status,
        confidenceDistance: status === 'Absent' ? 0 : Number((0.32 + (sIdx % 5) * 0.03).toFixed(3)),
        thresholdUsed: 0.52,
        verificationMethod: 'manual_demo',
        isSample: true,
      });
    });
  });

  return records;
}

export function buildSampleSessions(ownerUid: string): AttendanceSession[] {
  const dates = getRecentDateStrings(4);
  const subjects = buildSampleSubjects(ownerUid);
  return dates.slice(0, 3).map((dateStr, idx) => {
    const sub = subjects[idx];
    return {
      id: `sess_sample_${idx + 1}`,
      facultyUid: ownerUid,
      facultyName: sub.facultyName,
      subjectId: sub.id,
      subjectCode: sub.code,
      subjectName: sub.name,
      department: sub.department,
      semester: sub.semester,
      date: dateStr,
      threshold: 0.52,
      status: 'completed',
      recognizedCount: 5 + (idx % 2),
      isSample: true,
    };
  });
}
