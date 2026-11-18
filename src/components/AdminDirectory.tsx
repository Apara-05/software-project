import React, { useMemo, useState } from 'react';
import { BookOpen, Plus, Search, Trash2, UserCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { DataSourceFilter, UserRole } from '../types';

type DirectoryTab = 'students' | 'faculty' | 'subjects' | 'users';

export function AdminDirectory({
  onEnrollNewStudent,
}: {
  onEnrollNewStudent: () => void;
}) {
  const {
    students,
    faculty,
    subjects,
    usersList,
    addFaculty,
    removeFaculty,
    removeStudent,
    addSubject,
    removeSubject,
    changeUserRole,
    actionBusy,
    isSandboxMode,
  } = useApp();

  const [tab, setTab] = useState<DirectoryTab>('students');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<DataSourceFilter>('all');

  // Faculty form
  const [facName, setFacName] = useState('');
  const [facEmail, setFacEmail] = useState('');
  const [facDept, setFacDept] = useState('CSE');
  const [facDesignation, setFacDesignation] = useState('Assistant Professor');

  // Subject form
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subDept, setSubDept] = useState('CSE');
  const [subSem, setSubSem] = useState('Sem 6');
  const [subFaculty, setSubFaculty] = useState('');

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (sourceFilter === 'live' && s.isSample) return false;
      if (sourceFilter === 'sample' && !s.isSample) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
      );
    });
  }, [students, searchTerm, sourceFilter]);

  const handleAddFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facName.trim() || !facEmail.trim()) return;
    await addFaculty({
      name: facName,
      email: facEmail,
      department: facDept,
      designation: facDesignation,
    });
    setFacName('');
    setFacEmail('');
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim()) return;
    await addSubject({
      code: subCode,
      name: subName,
      department: subDept,
      semester: subSem,
      facultyName: subFaculty.trim() || faculty[0]?.name || 'Assigned Faculty',
    });
    setSubCode('');
    setSubName('');
    setSubFaculty('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1E3D]">Directory & Catalog Management</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Manage enrolled students, faculty members, academic subjects, and user role assignments.
          </p>
        </div>

        <button
          type="button"
          onClick={onEnrollNewStudent}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Enroll Student with Webcam
        </button>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-200/70 rounded-lg w-fit">
        {(
          [
            { id: 'students', label: `Students (${students.length})`, icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'faculty', label: `Faculty (${faculty.length})`, icon: <UserCheck className="w-3.5 h-3.5" /> },
            { id: 'subjects', label: `Subjects (${subjects.length})`, icon: <BookOpen className="w-3.5 h-3.5" /> },
            ...(!isSandboxMode ? [{ id: 'users' as DirectoryTab, label: `Users (${usersList.length})`, icon: <Users className="w-3.5 h-3.5" /> }] : []),
          ] as Array<{ id: DirectoryTab; label: string; icon: React.ReactNode }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-white text-[#0F1E3D] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {/* STUDENTS TAB */}
      {tab === 'students' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, roll number, or department"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'live', 'sample'] as DataSourceFilter[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSourceFilter(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Face Descriptor</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                      No students match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu) => (
                    <tr key={stu.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{stu.name}</div>
                        <div className="text-xs text-slate-500">{stu.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700">
                        {stu.rollNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{stu.department}</td>
                      <td className="py-3 px-4 text-slate-700">{stu.semester}</td>
                      <td className="py-3 px-4 text-xs">
                        {stu.faceRegistered ? (
                          <span className="font-semibold text-emerald-700">
                            Enrolled (128-d Vector)
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            Pending Webcam Capture
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {stu.isSample ? 'Sample Data' : 'Live Registered'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => removeStudent(stu.id)}
                          aria-label={`Delete ${stu.name}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FACULTY TAB */}
      {tab === 'faculty' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAddFaculty}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-[#0F1E3D]">Add Faculty Member</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={facName}
                onChange={(e) => setFacName(e.target.value)}
                placeholder="Dr. Meenakshi Rao"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={facEmail}
                onChange={(e) => setFacEmail(e.target.value)}
                placeholder="meenakshi.rao@college.edu"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={facDept}
                  onChange={(e) => setFacDept(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="IT">IT</option>
                  <option value="AIML">AIML</option>
                  <option value="ME">ME</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={facDesignation}
                  onChange={(e) => setFacDesignation(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={actionBusy}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0F1E3D] hover:bg-[#1A3160] rounded-lg transition-colors disabled:opacity-50"
            >
              Save Faculty Member
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Faculty Name</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {faculty.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{f.name}</div>
                        <div className="text-xs text-slate-500">{f.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{f.department}</td>
                      <td className="py-3 px-4 text-slate-700">{f.designation}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {f.isSample ? 'Sample Data' : 'Live Entry'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => removeFaculty(f.id)}
                          aria-label={`Delete ${f.name}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBJECTS TAB */}
      {tab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAddSubject}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-[#0F1E3D]">Create Subject</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Course Code</label>
              <input
                type="text"
                required
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                placeholder="CS605"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject Title</label>
              <input
                type="text"
                required
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="Deep Learning"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={subDept}
                  onChange={(e) => setSubDept(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="IT">IT</option>
                  <option value="AIML">AIML</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                <select
                  value={subSem}
                  onChange={(e) => setSubSem(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="Sem 4">Sem 4</option>
                  <option value="Sem 6">Sem 6</option>
                  <option value="Sem 8">Sem 8</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Faculty</label>
              <input
                type="text"
                value={subFaculty}
                onChange={(e) => setSubFaculty(e.target.value)}
                placeholder={faculty[0]?.name || 'Dr. Rajesh Nair'}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <button
              type="submit"
              disabled={actionBusy}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0F1E3D] hover:bg-[#1A3160] rounded-lg transition-colors disabled:opacity-50"
            >
              Add Subject
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Faculty</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {subjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-[#0F1E3D]">
                        {sub.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">{sub.name}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {sub.department} · {sub.semester}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{sub.facultyName}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => removeSubject(sub.id)}
                          aria-label={`Delete ${sub.code}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* USERS ROLE MANAGEMENT TAB */}
      {tab === 'users' && !isSandboxMode && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Display Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {usersList.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-medium text-slate-900">{u.displayName}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => changeUserRole(u.uid, e.target.value as UserRole)}
                        className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md bg-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="faculty">Faculty</option>
                        <option value="student">Student</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
