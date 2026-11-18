import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Database,
  Download,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportAttendanceRecordsCsv } from '../lib/csvExport';
import { formatIsoDate } from '../data/sampleData';
import type { DataSourceFilter } from '../types';

export function AdminOverview() {
  const {
    students,
    faculty,
    subjects,
    attendanceRecords,
    seedSampleData,
    clearSampleData,
    actionBusy,
  } = useApp();

  const [sourceFilter, setSourceFilter] = useState<DataSourceFilter>('all');

  const filteredAttendance = useMemo(() => {
    if (sourceFilter === 'live') return attendanceRecords.filter((r) => !r.isSample);
    if (sourceFilter === 'sample') return attendanceRecords.filter((r) => r.isSample);
    return attendanceRecords;
  }, [attendanceRecords, sourceFilter]);

  const todayStr = formatIsoDate(new Date());

  const stats = useMemo(() => {
    const liveStudents = students.filter((s) => !s.isSample).length;
    const sampleStudents = students.filter((s) => s.isSample).length;
    const faceEnrolled = students.filter((s) => s.faceRegistered).length;

    const todayRecords = filteredAttendance.filter((r) => r.date === todayStr);
    const todayPresent = todayRecords.filter(
      (r) => r.status === 'Present' || r.status === 'Late',
    ).length;

    const totalRecords = filteredAttendance.length;
    const attendedRecords = filteredAttendance.filter(
      (r) => r.status === 'Present' || r.status === 'Late',
    ).length;
    const overallPct =
      totalRecords > 0 ? Math.round((attendedRecords / totalRecords) * 1000) / 10 : 0;

    return {
      totalStudents: students.length,
      liveStudents,
      sampleStudents,
      faceEnrolled,
      totalFaculty: faculty.length,
      todayPresent,
      todayTotal: todayRecords.length,
      overallPct,
      liveAttendanceCount: attendanceRecords.filter((r) => !r.isSample).length,
      sampleAttendanceCount: attendanceRecords.filter((r) => r.isSample).length,
    };
  }, [students, faculty, filteredAttendance, attendanceRecords, todayStr]);

  const dailyChartData = useMemo(() => {
    const byDate = new Map<string, { date: string; present: number; late: number; absent: number }>();
    filteredAttendance.forEach((rec) => {
      const entry = byDate.get(rec.date) || {
        date: rec.date.slice(5),
        present: 0,
        late: 0,
        absent: 0,
      };
      if (rec.status === 'Present') entry.present += 1;
      else if (rec.status === 'Late') entry.late += 1;
      else entry.absent += 1;
      byDate.set(rec.date, entry);
    });

    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([, v]) => v);
  }, [filteredAttendance]);

  const subjectChartData = useMemo(() => {
    const map = new Map<string, { code: string; attended: number; total: number }>();
    subjects.forEach((sub) => {
      map.set(sub.id, { code: sub.code, attended: 0, total: 0 });
    });
    filteredAttendance.forEach((rec) => {
      const item = map.get(rec.subjectId) || {
        code: rec.subjectCode,
        attended: 0,
        total: 0,
      };
      item.total += 1;
      if (rec.status === 'Present' || rec.status === 'Late') {
        item.attended += 1;
      }
      map.set(rec.subjectId, item);
    });

    return Array.from(map.values()).map((item) => ({
      code: item.code,
      percentage: item.total > 0 ? Math.round((item.attended / item.total) * 100) : 0,
    }));
  }, [subjects, filteredAttendance]);

  const recentRecords = useMemo(() => {
    return [...filteredAttendance]
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 8);
  }, [filteredAttendance]);

  return (
    <div className="space-y-6">
      {/* Header Row & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1E3D]">Institutional Overview</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Real-time biometric enrollment and attendance analytics across departments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(['all', 'live', 'sample'] as DataSourceFilter[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSourceFilter(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sourceFilter === mode
                    ? 'bg-white text-[#0F1E3D] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode === 'all'
                  ? 'All Records'
                  : mode === 'live'
                    ? `Live Only (${stats.liveAttendanceCount})`
                    : `Sample Only (${stats.sampleAttendanceCount})`}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => exportAttendanceRecordsCsv(filteredAttendance, 'overview-attendance')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F1E3D] hover:bg-[#19305E] rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Students</div>
          <div className="text-3xl font-bold text-[#0F1E3D] font-mono tabular-nums mt-2">
            {stats.totalStudents}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {stats.liveStudents} live · {stats.sampleStudents} sample · {stats.faceEnrolled} face enrolled
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Faculty</div>
          <div className="text-3xl font-bold text-[#0F1E3D] font-mono tabular-nums mt-2">
            {stats.totalFaculty}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {subjects.length} active subjects assigned
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Today&apos;s Attendance</div>
          <div className="text-3xl font-bold text-[#0F1E3D] font-mono tabular-nums mt-2">
            {stats.todayPresent}
            <span className="text-base font-normal text-slate-400">
              {' '}
              / {stats.todayTotal}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
            Date: {todayStr}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Overall Attendance Rate</div>
          <div className="text-3xl font-bold text-[#2563EB] font-mono tabular-nums mt-2">
            {stats.overallPct}%
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Computed across {filteredAttendance.length} logged records
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F1E3D]">Daily Attendance Volume</h2>
              <p className="text-xs text-slate-500">Present, Late, and Absent counts by date</p>
            </div>
          </div>
          {dailyChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No attendance records match the current filter.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="present" name="Present" fill="#0F1E3D" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#0F1E3D]">Subject-Wise Attendance %</h2>
              <p className="text-xs text-slate-500">Percentage of attended sessions per course</p>
            </div>
          </div>
          {subjectChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-500">
              No subject metrics available yet.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} unit="%" />
                  <Tooltip formatter={(val) => [`${val ?? 0}%`, 'Attendance']} />
                  <Bar dataKey="percentage" name="Attendance %" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Recent Attendance + Sample Dataset Controls */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0F1E3D]">Recent Attendance Log</h2>
            <p className="text-xs text-slate-500">
              Latest entries distinguishing verified live webcam matches from sample demo data.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={seedSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F1E3D] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <RefreshCw className="w-3 h-3" />
              Seed Sample Data
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={clearSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Sample Data
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Roll No.</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Distance</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {recentRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                    No attendance records found. Start a Faculty webcam session or seed sample data.
                  </td>
                </tr>
              ) : (
                recentRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-medium text-slate-900">{rec.studentName}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {rec.rollNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {rec.subjectCode} · {rec.subjectName}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                      {rec.date} {rec.time}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          rec.status === 'Present'
                            ? 'text-emerald-700'
                            : rec.status === 'Late'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                      {rec.confidenceDistance > 0 ? rec.confidenceDistance.toFixed(3) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-600">
                      {rec.isSample ? 'Sample Data' : 'Live Webcam'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
