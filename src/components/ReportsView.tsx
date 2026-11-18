import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { downloadCsvFile, exportAttendanceRecordsCsv } from '../lib/csvExport';
import type { DataSourceFilter } from '../types';

type ReportTab = 'daily' | 'subject' | 'student';

export function ReportsView() {
  const { attendanceRecords, students, subjects } = useApp();

  const [reportTab, setReportTab] = useState<ReportTab>('daily');
  const [sourceFilter, setSourceFilter] = useState<DataSourceFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  const availableDates = useMemo(() => {
    const set = new Set(attendanceRecords.map((r) => r.date));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [attendanceRecords]);

  const filteredRecords = useMemo(() => {
    return attendanceRecords
      .filter((r) => {
        if (sourceFilter === 'live' && r.isSample) return false;
        if (sourceFilter === 'sample' && !r.isSample) return false;
        if (selectedDate !== 'all' && r.date !== selectedDate) return false;
        if (selectedSubject !== 'all' && r.subjectId !== selectedSubject) return false;
        return true;
      })
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [attendanceRecords, sourceFilter, selectedDate, selectedSubject]);

  const subjectSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        subjectId: string;
        code: string;
        name: string;
        department: string;
        present: number;
        late: number;
        absent: number;
        total: number;
      }
    >();

    subjects.forEach((s) => {
      map.set(s.id, {
        subjectId: s.id,
        code: s.code,
        name: s.name,
        department: s.department,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      });
    });

    filteredRecords.forEach((r) => {
      const row = map.get(r.subjectId) || {
        subjectId: r.subjectId,
        code: r.subjectCode,
        name: r.subjectName,
        department: r.department,
        present: 0,
        late: 0,
        absent: 0,
        total: 0,
      };
      row.total += 1;
      if (r.status === 'Present') row.present += 1;
      else if (r.status === 'Late') row.late += 1;
      else row.absent += 1;
      map.set(r.subjectId, row);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      percentage:
        row.total > 0
          ? Math.round(((row.present + row.late) / row.total) * 1000) / 10
          : 0,
    }));
  }, [subjects, filteredRecords]);

  const studentSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        studentId: string;
        name: string;
        rollNumber: string;
        department: string;
        semester: string;
        isSample: boolean;
        attended: number;
        total: number;
      }
    >();

    students.forEach((s) => {
      if (sourceFilter === 'live' && s.isSample) return;
      if (sourceFilter === 'sample' && !s.isSample) return;
      map.set(s.id, {
        studentId: s.id,
        name: s.name,
        rollNumber: s.rollNumber,
        department: s.department,
        semester: s.semester,
        isSample: s.isSample,
        attended: 0,
        total: 0,
      });
    });

    filteredRecords.forEach((r) => {
      const row = map.get(r.studentId) || {
        studentId: r.studentId,
        name: r.studentName,
        rollNumber: r.rollNumber,
        department: r.department,
        semester: r.semester,
        isSample: r.isSample,
        attended: 0,
        total: 0,
      };
      row.total += 1;
      if (r.status === 'Present' || r.status === 'Late') row.attended += 1;
      map.set(r.studentId, row);
    });

    return Array.from(map.values()).map((row) => ({
      ...row,
      percentage: row.total > 0 ? Math.round((row.attended / row.total) * 1000) / 10 : 0,
    }));
  }, [students, filteredRecords, sourceFilter]);

  const handleExportCurrentReport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    if (reportTab === 'daily') {
      exportAttendanceRecordsCsv(filteredRecords, 'daily-attendance-report');
      return;
    }
    if (reportTab === 'subject') {
      downloadCsvFile(
        `subject-wise-attendance-${dateTag}.csv`,
        ['Code', 'Subject', 'Department', 'Present', 'Late', 'Absent', 'Total', 'Attendance %'],
        subjectSummary.map((r) => [
          r.code,
          r.name,
          r.department,
          r.present,
          r.late,
          r.absent,
          r.total,
          `${r.percentage}%`,
        ]),
      );
      return;
    }
    downloadCsvFile(
      `student-wise-attendance-${dateTag}.csv`,
      ['Roll Number', 'Student Name', 'Department', 'Semester', 'Attended', 'Total Classes', 'Attendance %', 'Source'],
      studentSummary.map((r) => [
        r.rollNumber,
        r.name,
        r.department,
        r.semester,
        r.attended,
        r.total,
        `${r.percentage}%`,
        r.isSample ? 'Sample Data' : 'Live Registered',
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1E3D]">Attendance Reports & CSV Export</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Inspect daily logs, subject-wise metrics, and student-wise attendance percentages.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCurrentReport}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0F1E3D] hover:bg-[#19305E] rounded-lg transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Export Report CSV
        </button>
      </div>

      {/* Filters & Report Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'daily', label: 'Daily Attendance' },
              { id: 'subject', label: 'Subject-Wise' },
              { id: 'student', label: 'Student-Wise %' },
            ] as Array<{ id: ReportTab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setReportTab(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                reportTab === t.id
                  ? 'bg-white text-[#0F1E3D] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="all">All Dates</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="all">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'live', 'sample'] as DataSourceFilter[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSourceFilter(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  sourceFilter === mode
                    ? 'bg-white text-[#0F1E3D] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'all' ? 'All' : mode === 'live' ? 'Live' : 'Sample'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Report Tables */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {reportTab === 'daily' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Roll No.</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Distance</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                      No daily records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                        {r.date} {r.time}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700">
                        {r.rollNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{r.studentName}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {r.subjectCode} · {r.subjectName}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        <span
                          className={
                            r.status === 'Present'
                              ? 'text-emerald-700'
                              : r.status === 'Late'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        {r.confidenceDistance > 0 ? r.confidenceDistance.toFixed(3) : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {r.isSample ? 'Sample Data' : 'Live Webcam'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'subject' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Subject Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-right">Present</th>
                  <th className="py-3 px-4 text-right">Late</th>
                  <th className="py-3 px-4 text-right">Absent</th>
                  <th className="py-3 px-4 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {subjectSummary.map((row) => (
                  <tr key={row.subjectId} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-[#0F1E3D]">
                      {row.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{row.name}</td>
                    <td className="py-3 px-4 text-slate-600">{row.department}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.present}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.late}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                      {row.absent}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#2563EB]">
                      {row.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportTab === 'student' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Roll No.</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-right">Attended</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Percentage</th>
                  <th className="py-3 px-4">Standing</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {studentSummary.map((row) => {
                  const lowStanding = row.total > 0 && row.percentage < 75;
                  return (
                    <tr key={row.studentId} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700">
                        {row.rollNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{row.name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {row.department} · {row.semester}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {row.attended}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {row.total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F1E3D]">
                        {row.percentage}%
                      </td>
                      <td className="py-3 px-4">
                        {row.total === 0 ? (
                          <span className="text-xs text-slate-400">No Records</span>
                        ) : lowStanding ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Below 75%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Nominal
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {row.isSample ? 'Sample Data' : 'Live Registered'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
