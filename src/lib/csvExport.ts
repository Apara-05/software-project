import type { AttendanceRecord } from '../types';

function escapeCsvField(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | boolean>>): void {
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => row.map(escapeCsvField).join(',')),
  ];
  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAttendanceRecordsCsv(records: AttendanceRecord[], filenamePrefix = 'attendance-report'): void {
  const headers = [
    'Record ID',
    'Date',
    'Time',
    'Roll Number',
    'Student Name',
    'Department',
    'Semester',
    'Subject Code',
    'Subject Name',
    'Faculty',
    'Status',
    'Euclidean Distance',
    'Threshold',
    'Method',
    'Data Source',
  ];

  const rows = records.map((r) => [
    r.id,
    r.date,
    r.time,
    r.rollNumber,
    r.studentName,
    r.department,
    r.semester,
    r.subjectCode,
    r.subjectName,
    r.facultyName,
    r.status,
    r.confidenceDistance.toFixed(4),
    r.thresholdUsed.toFixed(2),
    r.verificationMethod,
    r.isSample ? 'Sample Data' : 'Live Attendance',
  ]);

  const dateTag = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`${filenamePrefix}-${dateTag}.csv`, headers, rows);
}
