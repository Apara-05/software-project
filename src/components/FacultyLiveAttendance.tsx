import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Play,
  SlidersHorizontal,
  Square,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  detectAllFacesWithDescriptors,
  drawFaceOverlays,
  ensureFaceModelsLoaded,
  findBestDescriptorMatch,
  type ModelLoadState,
} from '../lib/faceRecognition';
import { formatIsoDate } from '../data/sampleData';
import type { AttendanceSession, RecognitionEvent } from '../types';

export function FacultyLiveAttendance({
  initialView = 'live',
}: {
  initialView?: 'live' | 'history';
}) {
  const {
    subjects,
    faceDescriptors,
    attendanceRecords,
    sessions,
    startSession,
    endSession,
    bumpSessionCount,
    recordAttendance,
  } = useApp();

  const [viewMode, setViewMode] = useState<'live' | 'history'>(initialView);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [sessionDate, setSessionDate] = useState<string>(formatIsoDate(new Date()));
  const [threshold, setThreshold] = useState<number>(0.52);

  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [modelState, setModelState] = useState<ModelLoadState>('idle');
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [events, setEvents] = useState<RecognitionEvent[]>([]);
  const [liveStatusMessage, setLiveStatusMessage] = useState<string>(
    'Select a subject and start an attendance session to activate webcam recognition.',
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopTimerRef = useRef<number | null>(null);
  const processingRef = useRef<boolean>(false);
  const markedCacheRef = useRef<Set<string>>(new Set());
  const lastEventStampRef = useRef<Map<string, number>>(new Map());
  const sessionCountRef = useRef<number>(0);

  const filteredSubjects = useMemo(() => {
    if (selectedDept === 'ALL') return subjects;
    return subjects.filter((s) => s.department === selectedDept);
  }, [subjects, selectedDept]);

  const currentSubject = useMemo(() => {
    return (
      filteredSubjects.find((s) => s.id === selectedSubjectId) ||
      filteredSubjects[0] ||
      null
    );
  }, [filteredSubjects, selectedSubjectId]);

  useEffect(() => {
    if (!selectedSubjectId && filteredSubjects.length > 0) {
      setSelectedSubjectId(filteredSubjects[0].id);
    }
  }, [filteredSubjects, selectedSubjectId]);

  // Keep local marked cache synchronized with Firestore attendance for selected subject & date
  useEffect(() => {
    if (!currentSubject) return;
    const set = new Set<string>();
    attendanceRecords
      .filter((r) => r.subjectId === currentSubject.id && r.date === sessionDate)
      .forEach((r) => set.add(r.studentId));
    markedCacheRef.current = set;
  }, [attendanceRecords, currentSubject, sessionDate]);

  const stopCamera = () => {
    if (loopTimerRef.current !== null) {
      window.clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
    return () => {
      stopCamera();
    };
  }, []);

  const pushEvent = (evt: Omit<RecognitionEvent, 'id' | 'timestamp'>) => {
    const now = Date.now();
    const dedupeKey = `${evt.type}_${evt.studentName || 'unknown'}`;
    const lastTs = lastEventStampRef.current.get(dedupeKey) || 0;
    if (now - lastTs < 3500) return;
    lastEventStampRef.current.set(dedupeKey, now);

    setEvents((prev) => [
      {
        id: `${now}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toTimeString().slice(0, 8),
        ...evt,
      },
      ...prev.slice(0, 29),
    ]);
  };

  const handleStartSession = async () => {
    if (!currentSubject) return;
    try {
      sessionCountRef.current = 0;
      const sess = await startSession(currentSubject, sessionDate, threshold);
      setActiveSession(sess);
      setEvents([]);
      setLiveStatusMessage(
        `Active session started for ${currentSubject.code} (${currentSubject.name}). Open webcam to scan students.`,
      );
    } catch (err) {
      setLiveStatusMessage(
        err instanceof Error ? `Failed to start session: ${err.message}` : 'Failed to start session.',
      );
    }
  };

  const handleEndSession = async () => {
    stopCamera();
    if (activeSession) {
      try {
        await endSession(activeSession.id, sessionCountRef.current);
        setLiveStatusMessage(
          `Session completed. ${sessionCountRef.current} student(s) recognized and marked.`,
        );
        setActiveSession(null);
      } catch (err) {
        setLiveStatusMessage(
          err instanceof Error ? `Failed to complete session: ${err.message}` : 'Failed to complete session.',
        );
      }
    }
  };

  const handleOpenWebcam = async () => {
    setCameraError(null);
    setModelError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Webcam API is unavailable in this browser context.');
      return;
    }

    try {
      setModelState('loading');
      await ensureFaceModelsLoaded();
      setModelState('ready');
    } catch (err) {
      setModelState('error');
      setModelError(
        err instanceof Error ? err.message : 'Failed to load face-api.js models from /models.',
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
      setLiveStatusMessage('Webcam active. Align student face in frame for recognition.');
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Camera access error: ${err.message}`
          : 'Unable to access webcam. Please allow camera permissions.',
      );
    }
  };

  // Real-time face detection & Euclidean matching loop
  useEffect(() => {
    if (!cameraActive || modelState !== 'ready') return;

    const runDetectionCycle = async () => {
      if (processingRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      processingRef.current = true;
      try {
        const detected = await detectAllFacesWithDescriptors(video);
        if (detected.length === 0) {
          drawFaceOverlays(canvas, video, []);
          return;
        }

        const overlays = [];
        for (const face of detected) {
          if (faceDescriptors.length === 0) {
            overlays.push({
              box: face.box,
              label: 'No Enrolled Descriptors',
              matched: false,
              landmarks: face.landmarks,
            });
            pushEvent({
              type: 'unknown',
              message: 'Face detected, but zero student face descriptors are enrolled yet.',
            });
            continue;
          }

          const match = findBestDescriptorMatch(
            face.descriptor,
            faceDescriptors,
            threshold,
          );

          if (match.matched && match.record) {
            const stu = match.record;
            overlays.push({
              box: face.box,
              label: `${stu.studentName} (${stu.rollNumber}) · d=${match.distance.toFixed(2)}`,
              matched: true,
              landmarks: face.landmarks,
            });

            if (activeSession && currentSubject) {
              if (markedCacheRef.current.has(stu.studentId)) {
                pushEvent({
                  type: 'duplicate',
                  studentName: stu.studentName,
                  rollNumber: stu.rollNumber,
                  distance: match.distance,
                  message: `Already marked today for ${currentSubject.code} (duplicate prevented).`,
                });
                setLiveStatusMessage(
                  `Matched ${stu.studentName} (${stu.rollNumber}) · Already marked for ${currentSubject.code} on ${sessionDate}.`,
                );
              } else {
                markedCacheRef.current.add(stu.studentId);
                try {
                  const res = await recordAttendance({
                    student: stu,
                    subject: currentSubject,
                    date: sessionDate,
                    status: 'Present',
                    confidenceDistance: match.distance,
                    thresholdUsed: threshold,
                    verificationMethod: 'face_recognition',
                  });

                  if (res.created) {
                    sessionCountRef.current += 1;
                    await bumpSessionCount(activeSession.id, sessionCountRef.current);
                    pushEvent({
                      type: 'matched',
                      studentName: stu.studentName,
                      rollNumber: stu.rollNumber,
                      distance: match.distance,
                      message: `Attendance marked Present (Euclidean distance ${match.distance.toFixed(3)} <= ${threshold.toFixed(2)}).`,
                    });
                    setLiveStatusMessage(
                      `Marked Present: ${stu.studentName} (${stu.rollNumber}) · d = ${match.distance.toFixed(3)}`,
                    );
                  } else {
                    pushEvent({
                      type: 'duplicate',
                      studentName: stu.studentName,
                      rollNumber: stu.rollNumber,
                      distance: match.distance,
                      message: `Duplicate attendance prevented for ${currentSubject.code} on ${sessionDate}.`,
                    });
                  }
                } catch (writeErr) {
                  markedCacheRef.current.delete(stu.studentId);
                  throw writeErr;
                }
              }
            }
          } else {
            const nearest = match.record
              ? `nearest: ${match.record.studentName} d=${match.distance.toFixed(2)}`
              : `d=${match.distance.toFixed(2)}`;
            overlays.push({
              box: face.box,
              label: `Unknown Face (${nearest})`,
              matched: false,
              landmarks: face.landmarks,
            });
            pushEvent({
              type: 'unknown',
              distance: match.distance,
              message: `Face rejected: distance ${match.distance.toFixed(3)} exceeds threshold ${threshold.toFixed(2)}.`,
            });
            setLiveStatusMessage(
              `Unrecognized face detected (distance ${match.distance.toFixed(3)} > threshold ${threshold.toFixed(2)}).`,
            );
          }
        }

        drawFaceOverlays(canvas, video, overlays);
      } catch (err) {
        pushEvent({
          type: 'error',
          message: err instanceof Error ? err.message : 'Recognition cycle error',
        });
      } finally {
        processingRef.current = false;
      }
    };

    loopTimerRef.current = window.setInterval(runDetectionCycle, 450);
    return () => {
      if (loopTimerRef.current !== null) {
        window.clearInterval(loopTimerRef.current);
        loopTimerRef.current = null;
      }
    };
  }, [
    cameraActive,
    modelState,
    faceDescriptors,
    threshold,
    activeSession,
    currentSubject,
    sessionDate,
  ]);

  const sessionMarkedRows = useMemo(() => {
    if (!currentSubject) return [];
    return attendanceRecords
      .filter((r) => r.subjectId === currentSubject.id && r.date === sessionDate)
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [attendanceRecords, currentSubject, sessionDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1E3D]">
            Faculty Live Attendance & Recognition
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Start a class session, open the webcam, and mark attendance automatically via face-api.js descriptor matching.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('live')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'live'
                ? 'bg-white text-[#0F1E3D] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Session
          </button>
          <button
            type="button"
            onClick={() => setViewMode('history')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'history'
                ? 'bg-white text-[#0F1E3D] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Session History ({sessions.length})
          </button>
        </div>
      </div>

      {viewMode === 'live' ? (
        <div className="space-y-6">
          {/* Configuration Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Department
              </label>
              <select
                disabled={Boolean(activeSession)}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
              >
                <option value="ALL">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="IT">IT</option>
              </select>
            </div>

            <div className="xl:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Class & Subject
              </label>
              <select
                disabled={Boolean(activeSession)}
                value={currentSubject?.id || ''}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
              >
                {filteredSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} · {sub.name} ({sub.department} {sub.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Session Date
              </label>
              <input
                type="date"
                disabled={Boolean(activeSession)}
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                <span className="inline-flex items-center gap-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#2563EB]" />
                  Threshold
                </span>
                <span className="font-mono tabular-nums text-[#0F1E3D]">
                  {threshold.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.35}
                max={0.7}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[#2563EB]"
              />
            </div>
          </div>

          {/* Main Live Recognition Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Webcam Viewport */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#0F1E3D]">
                    Webcam Face Recognition Feed
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enrolled biometric descriptors loaded: {faceDescriptors.length} student(s)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!activeSession ? (
                    <button
                      type="button"
                      disabled={!currentSubject}
                      onClick={handleStartSession}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0F1E3D] hover:bg-[#19305E] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Attendance Session
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEndSession}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      <Square className="w-3.5 h-3.5" />
                      End Session
                    </button>
                  )}

                  {!cameraActive ? (
                    <button
                      type="button"
                      disabled={!activeSession || modelState === 'loading'}
                      onClick={handleOpenWebcam}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {modelState === 'loading' ? 'Loading Models...' : 'Open Webcam'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      Close Webcam
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {(cameraError || modelError) && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{cameraError || modelError}</span>
                  </div>
                )}

                {faceDescriptors.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                    No student face descriptors are registered in the database yet. Open the Student Enrollment portal to capture at least one student face via webcam before running recognition.
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
                      <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                      <p className="text-sm font-medium text-slate-300">
                        {activeSession
                          ? 'Session ready — click "Open Webcam" to begin scanning'
                          : 'Click "Start Attendance Session" above to activate camera'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Lower threshold (e.g. 0.45) is stricter; higher (e.g. 0.60) is more tolerant of lighting changes.
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-700 font-medium">
                  {liveStatusMessage}
                </div>
              </div>
            </div>

            {/* Right Panel: Live Recognition Events & Session Roster */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F1E3D]">
                    Recognition Decision Log
                  </h3>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    Threshold: {threshold.toFixed(2)}
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {events.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Live match successes and rejection alerts will appear here.
                    </div>
                  ) : (
                    events.map((evt) => (
                      <div key={evt.id} className="px-4 py-3 flex items-start gap-2.5 text-xs">
                        {evt.type === 'matched' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : evt.type === 'duplicate' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {evt.studentName
                                ? `${evt.studentName} (${evt.rollNumber})`
                                : 'Unrecognized Subject'}
                            </span>
                            <span className="font-mono tabular-nums text-slate-400">
                              {evt.timestamp}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">{evt.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0F1E3D]">
                    Marked Today ({currentSubject?.code || '—'})
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-[#2563EB] font-semibold">
                    {sessionMarkedRows.length} Marked
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {sessionMarkedRows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No attendance logged yet for {currentSubject?.code || 'this subject'} on {sessionDate}.
                    </div>
                  ) : (
                    sessionMarkedRows.map((row) => (
                      <div
                        key={row.id}
                        className="px-4 py-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium text-slate-900">{row.studentName}</div>
                          <div className="font-mono tabular-nums text-slate-500">
                            {row.rollNumber} · {row.time}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-700">{row.status}</div>
                          <div className="font-mono tabular-nums text-slate-400">
                            d={row.confidenceDistance.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Session History View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Faculty</th>
                  <th className="py-3 px-4 text-right">Threshold</th>
                  <th className="py-3 px-4 text-right">Recognized</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                      No attendance sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-700">
                        {s.date}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {s.subjectCode} · {s.subjectName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {s.department} · {s.semester}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{s.facultyName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        {s.threshold.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#0F1E3D]">
                        {s.recognizedCount}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold capitalize text-slate-700">
                        {s.status}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {s.isSample ? 'Sample Data' : 'Live Session'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
