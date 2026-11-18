import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  averageDescriptors,
  detectSingleFaceWithDescriptor,
  drawFaceOverlays,
  ensureFaceModelsLoaded,
  type ModelLoadState,
} from '../lib/faceRecognition';

export function StudentPortal({
  initialTab = 'enroll',
}: {
  initialTab?: 'enroll' | 'history';
}) {
  const {
    userProfile,
    students,
    attendanceRecords,
    registerStudent,
    actionBusy,
  } = useApp();

  const [tab, setTab] = useState<'enroll' | 'history'>(initialTab);

  // Registration Form State
  const [name, setName] = useState(userProfile?.displayName || '');
  const [rollNumber, setRollNumber] = useState('');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [department, setDepartment] = useState('CSE');
  const [semester, setSemester] = useState('Sem 6');
  const [biometricConsent, setBiometricConsent] = useState(false);

  // Webcam & Face Capture State
  const [modelState, setModelState] = useState<ModelLoadState>('idle');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedSamples, setCapturedSamples] = useState<number>(0);
  const [averagedDescriptor, setAveragedDescriptor] = useState<number[] | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // History viewer student selector
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const busyDetectRef = useRef<boolean>(false);

  const stopCamera = () => {
    if (previewTimerRef.current !== null) {
      window.clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (userProfile) {
      setName((prev) => prev || userProfile.displayName || '');
      setEmail((prev) => prev || userProfile.email || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (!selectedStudentId && students.length > 0) {
      const own = students.find(
        (s) => !s.isSample && s.email.toLowerCase() === userProfile?.email?.toLowerCase(),
      );
      setSelectedStudentId(own?.id || students[0].id);
    }
  }, [students, selectedStudentId, userProfile]);

  const handleOpenWebcam = async () => {
    setCameraError(null);
    setFormError(null);
    if (!biometricConsent) {
      setFormError('Please provide explicit Biometric Data Collection Consent before opening the webcam.');
      return;
    }

    try {
      setModelState('loading');
      await ensureFaceModelsLoaded();
      setModelState('ready');
    } catch (err) {
      setModelState('error');
      setCameraError(
        err instanceof Error ? err.message : 'Unable to load face-api.js models.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Camera access denied or unavailable.',
      );
    }
  };

  // Live face alignment preview loop
  useEffect(() => {
    if (!cameraActive || modelState !== 'ready') return;

    const previewFrame = async () => {
      if (busyDetectRef.current || capturing) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      busyDetectRef.current = true;
      try {
        const res = await detectSingleFaceWithDescriptor(video);
        if (res) {
          drawFaceOverlays(canvas, video, [
            {
              box: res.box,
              label: `Face Detected (${Math.round(res.score * 100)}%)`,
              matched: true,
              landmarks: res.landmarks,
            },
          ]);
        } else {
          drawFaceOverlays(canvas, video, []);
        }
      } finally {
        busyDetectRef.current = false;
      }
    };

    previewTimerRef.current = window.setInterval(previewFrame, 400);
    return () => {
      if (previewTimerRef.current !== null) {
        window.clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, [cameraActive, modelState, capturing]);

  const handleCaptureFaceDescriptor = async () => {
    setFormError(null);
    setCameraError(null);
    if (!videoRef.current || !cameraActive) {
      setFormError('Open the webcam first to capture a face descriptor.');
      return;
    }

    setCapturing(true);
    setCapturedSamples(0);
    const collected: Float32Array[] = [];

    try {
      for (let attempt = 0; attempt < 10 && collected.length < 3; attempt += 1) {
        const result = await detectSingleFaceWithDescriptor(videoRef.current);
        if (result) {
          collected.push(result.descriptor);
          setCapturedSamples(collected.length);
          if (canvasRef.current) {
            drawFaceOverlays(canvasRef.current, videoRef.current, [
              {
                box: result.box,
                label: `Captured Sample ${collected.length}/3`,
                matched: true,
                landmarks: result.landmarks,
              },
            ]);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 260));
      }

      if (collected.length < 3) {
        setFormError(
          `Only ${collected.length}/3 clear face frames detected. Please center your face in good lighting and try again.`,
        );
        return;
      }

      const avg = averageDescriptors(collected);
      setAveragedDescriptor(avg);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Face capture failed.');
    } finally {
      setCapturing(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaveMessage(null);

    if (!name.trim() || !rollNumber.trim() || !email.trim()) {
      setFormError('Name, Roll Number, and Email are required.');
      return;
    }
    if (!biometricConsent) {
      setFormError('Explicit Biometric Data Collection Consent is required.');
      return;
    }
    if (!averagedDescriptor || averagedDescriptor.length !== 128) {
      setFormError('Please capture your 128-d face descriptor via the webcam before saving.');
      return;
    }

    try {
      const saved = await registerStudent({
        name,
        rollNumber,
        email,
        department,
        semester,
        biometricConsent: true,
        descriptor: averagedDescriptor,
        sampleCount: 3,
      });

      stopCamera();
      setSelectedStudentId(saved.id);
      setSaveMessage(
        `Student ${saved.name} (${saved.rollNumber}) registered with a 128-d face descriptor. Ready for live Faculty webcam recognition.`,
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save student registration.');
    }
  };

  const activeStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  const studentRecords = useMemo(() => {
    if (!activeStudent) return [];
    return attendanceRecords
      .filter((r) => r.studentId === activeStudent.id)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [attendanceRecords, activeStudent]);

  const studentStats = useMemo(() => {
    const total = studentRecords.length;
    const attended = studentRecords.filter(
      (r) => r.status === 'Present' || r.status === 'Late',
    ).length;
    const missed = total - attended;
    const pct = total > 0 ? Math.round((attended / total) * 1000) / 10 : 0;

    const bySubject = new Map<string, { code: string; attended: number; total: number }>();
    studentRecords.forEach((r) => {
      const entry = bySubject.get(r.subjectId) || {
        code: r.subjectCode,
        attended: 0,
        total: 0,
      };
      entry.total += 1;
      if (r.status === 'Present' || r.status === 'Late') entry.attended += 1;
      bySubject.set(r.subjectId, entry);
    });

    const subjectChart = Array.from(bySubject.values()).map((item) => ({
      code: item.code,
      percentage: item.total > 0 ? Math.round((item.attended / item.total) * 100) : 0,
    }));

    return { total, attended, missed, pct, subjectChart };
  }, [studentRecords]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1E3D]">Student Registration & Portal</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Register student profile, capture 128-d face descriptor with consent, and inspect attendance history.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('enroll')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'enroll'
                ? 'bg-white text-[#0F1E3D] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Registration & Face Capture
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'history'
                ? 'bg-white text-[#0F1E3D] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Attendance History
          </button>
        </div>
      </div>

      {tab === 'enroll' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Student Details & Biometric Consent Form */}
          <form
            onSubmit={handleSaveStudent}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-base font-semibold text-[#0F1E3D]">
              01. Student Profile & Biometric Consent
            </h2>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {saveMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{saveMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ananya Sharma"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Roll Number</label>
                <input
                  type="text"
                  required
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="BT23CSE042"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ananya@student.edu"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
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
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Sem 2">Sem 2</option>
                  <option value="Sem 4">Sem 4</option>
                  <option value="Sem 6">Sem 6</option>
                  <option value="Sem 8">Sem 8</option>
                </select>
              </div>
            </div>

            {/* Explicit Biometric Consent */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0F1E3D]">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                <span>Biometric Data Collection Consent</span>
              </div>
              <label className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={biometricConsent}
                  onChange={(e) => setBiometricConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#2563EB]"
                />
                <span>
                  I consent to generating a 128-dimensional mathematical facial descriptor from my webcam feed and storing it in Firebase Firestore strictly for academic attendance verification. No raw facial photographs are uploaded.
                </span>
              </label>
            </div>

            <div className="pt-1">
              <div className="text-xs text-slate-600 mb-3 flex items-center justify-between">
                <span>Descriptor Status:</span>
                {averagedDescriptor ? (
                  <span className="font-semibold text-emerald-700 font-mono">
                    Ready (128-d Vector · 3 Samples)
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">Awaiting Webcam Capture</span>
                )}
              </div>
              <button
                type="submit"
                disabled={actionBusy || !averagedDescriptor || !biometricConsent}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#0F1E3D] hover:bg-[#19305E] rounded-lg transition-colors disabled:opacity-50"
              >
                {actionBusy ? 'Saving to Database...' : 'Register Student & Save Descriptor'}
              </button>
            </div>
          </form>

          {/* Webcam Capture Card */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#0F1E3D]">
                  02. Webcam Face Descriptor Capture
                </h2>
                <p className="text-xs text-slate-500">
                  Captures 3 aligned webcam frames via face-api.js and averages into a 128-d vector.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!cameraActive ? (
                  <button
                    type="button"
                    disabled={!biometricConsent || modelState === 'loading'}
                    onClick={handleOpenWebcam}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {modelState === 'loading' ? 'Loading Models...' : 'Open Webcam'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={capturing}
                      onClick={handleCaptureFaceDescriptor}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ScanFace className="w-3.5 h-3.5" />
                      {capturing
                        ? `Capturing (${capturedSamples}/3)...`
                        : 'Capture 3-Frame Descriptor'}
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {cameraError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                  {cameraError}
                </div>
              )}

              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
                    cameraActive ? 'block' : 'hidden'
                  }`}
                />
                {!cameraActive && (
                  <div className="text-center px-6 space-y-2">
                    <ScanFace className="w-10 h-10 text-slate-500 mx-auto" />
                    <p className="text-sm font-medium text-slate-300">
                      {biometricConsent
                        ? 'Consent confirmed — click "Open Webcam" to begin capture'
                        : 'Check Biometric Consent on the left to enable webcam capture'}
                    </p>
                  </div>
                )}
              </div>

              {averagedDescriptor && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                  <div className="text-xs font-semibold text-[#0F1E3D]">
                    Extracted 128-Dimensional Embedding Preview
                  </div>
                  <div className="text-xs font-mono text-slate-600 break-all">
                    [{averagedDescriptor.slice(0, 8).map((v) => v.toFixed(4)).join(', ')}, ... (128 floats)]
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Student Attendance History Tab */
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm font-medium text-slate-700">
              Viewing Attendance Profile:
            </div>
            <select
              value={activeStudent?.id || ''}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[260px]"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rollNumber}) · {s.isSample ? 'Sample' : 'Live'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Attendance Percentage</div>
              <div className="text-3xl font-bold text-[#2563EB] font-mono tabular-nums mt-2">
                {studentStats.pct}%
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {studentStats.total === 0
                  ? 'No classes recorded'
                  : studentStats.pct >= 75
                    ? 'Meets 75% requirement'
                    : 'Below 75% threshold'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Classes Attended</div>
              <div className="text-3xl font-bold text-[#0F1E3D] font-mono tabular-nums mt-2">
                {studentStats.attended}
              </div>
              <div className="text-xs text-slate-500 mt-1">Out of {studentStats.total} sessions</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Classes Missed</div>
              <div className="text-3xl font-bold text-slate-700 font-mono tabular-nums mt-2">
                {studentStats.missed}
              </div>
              <div className="text-xs text-slate-500 mt-1">Recorded absent</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs font-medium text-slate-500">Biometric Status</div>
              <div className="text-base font-bold text-[#0F1E3D] mt-2">
                {activeStudent?.faceRegistered ? '128-d Vector Active' : 'Not Enrolled'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeStudent?.department || '—'} · {activeStudent?.semester || '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-[#0F1E3D] mb-4">
                Subject-Wise Attendance %
              </h2>
              {studentStats.subjectChart.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-slate-500">
                  No subject attendance logs yet.
                </div>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={studentStats.subjectChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="code" tick={{ fontSize: 12, fill: '#475569' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} unit="%" />
                      <Tooltip formatter={(val) => [`${val ?? 0}%`, 'Attendance']} />
                      <Bar dataKey="percentage" fill="#0F1E3D" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-[#0F1E3D]">
                  Personal Attendance Log
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Distance</th>
                      <th className="py-3 px-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {studentRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-4 text-center text-slate-500">
                          No attendance records found for this student.
                        </td>
                      </tr>
                    ) : (
                      studentRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600">
                            {r.date} {r.time}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
