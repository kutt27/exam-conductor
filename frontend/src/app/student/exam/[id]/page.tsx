"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useExamSecurity } from "@/hooks/useExamSecurity";
import { CodeDocEditor } from "@/components/exam/CodeDocEditor";
import { McqCard } from "@/components/exam/McqCard";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { SecurityWarningModal } from "@/components/exam/SecurityWarningModal";

interface Question {
  id: string;
  type: "MCQ" | "CODE_DOC";
  order_index: number;
  prompt: string;
  max_marks: number;
  mcq_options?: string[];
}

interface ExamDetail {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  timer_mode?: "LOCAL" | "GLOBAL";
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  questions: Question[];
}

export default function StudentExamRunnerPage() {
  const params = useParams();
  const examId = params.id as string;
  const router = useRouter();
  const { user } = useAuth();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExamClosed, setIsExamClosed] = useState(false);

  // Fullscreen Lockdown State
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [isFullscreenActive, setIsFullscreenActive] = useState(false);

  // Anti-cheat state
  const [strikes, setStrikes] = useState<Array<{ reason: string; timestamp: string }>>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastViolationReason, setLastViolationReason] = useState("");

  // Storage key prefix unique to this exam and logged-in student
  const studentKey = user?.id || "anon";
  const storagePrefix = `exam_session_${examId}_${studentKey}`;

  // Helper to shuffle an array (Fisher-Yates)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  useEffect(() => {
    async function loadExam() {
      try {
        const data = await apiRequest<ExamDetail>(`/exams/student/${examId}`);
        
        // 1. Manage Randomized MCQ Question Order with LocalStorage persistence
        const orderStorageKey = `${storagePrefix}_q_order`;
        const storedOrderJson = typeof window !== "undefined" ? localStorage.getItem(orderStorageKey) : null;

        if (storedOrderJson) {
          try {
            const storedIds: string[] = JSON.parse(storedOrderJson);
            const qMap = new Map(data.questions.map((q) => [q.id, q]));
            const orderedQuestions: Question[] = [];

            storedIds.forEach((id) => {
              const q = qMap.get(id);
              if (q) {
                orderedQuestions.push(q);
                qMap.delete(id);
              }
            });

            // Append any newly added questions if applicable
            qMap.forEach((q) => orderedQuestions.push(q));
            data.questions = orderedQuestions;
          } catch (e) {
            console.error("Error restoring stored question order", e);
          }
        } else {
          // Separate Multiple Choice Questions and randomize them per student
          const mcqQuestions = (data.questions || []).filter((q) => q.type === "MCQ");
          const otherQuestions = (data.questions || []).filter((q) => q.type !== "MCQ");

          // Randomly shuffle MCQs
          const shuffledMcqs = shuffleArray(mcqQuestions);

          // Combined questions: Shuffled MCQs followed by Code Documents
          const randomizedQuestions = [...shuffledMcqs, ...otherQuestions];
          data.questions = randomizedQuestions;

          // Save the randomized order in localStorage for this student session
          if (typeof window !== "undefined") {
            localStorage.setItem(orderStorageKey, JSON.stringify(randomizedQuestions.map((q) => q.id)));
          }
        }

        // 2. Restore Saved Draft Answers
        if (typeof window !== "undefined") {
          const savedDraft = localStorage.getItem(`${storagePrefix}_answers`);
          if (savedDraft) {
            try {
              setAnswers(JSON.parse(savedDraft));
            } catch (e) {
              console.error("Error restoring draft answers", e);
            }
          }

          const savedStrikes = localStorage.getItem(`${storagePrefix}_strikes`);
          if (savedStrikes) {
            try {
              setStrikes(JSON.parse(savedStrikes));
            } catch (e) {
              console.error("Error restoring strikes", e);
            }
          }

          const savedIndex = localStorage.getItem(`${storagePrefix}_curr_q`);
          if (savedIndex) {
            const parsedIdx = parseInt(savedIndex, 10);
            if (!isNaN(parsedIdx) && parsedIdx >= 0 && parsedIdx < data.questions.length) {
              setCurrentQIndex(parsedIdx);
            }
          }

          const sessionStarted = localStorage.getItem(`${storagePrefix}_started`);
          if (sessionStarted === "true") {
            setHasStartedSession(true);
          }
        }

        setExam(data);
      } catch (err: any) {
        alert("Failed to load exam: " + err.message);
        router.push("/student/exams");
      } finally {
        setLoading(false);
      }
    }

    loadExam();
  }, [examId, router, storagePrefix]);

  // Anti-cheat handler
  const handleStrike = useCallback((reason: string) => {
    if (isSubmitting || !hasStartedSession) return;

    const event = {
      reason,
      timestamp: new Date().toISOString(),
    };
    
    setStrikes((prev) => {
      const updated = [...prev, event];
      if (typeof window !== "undefined") {
        localStorage.setItem(`${storagePrefix}_strikes`, JSON.stringify(updated));
      }

      // Sync strike to live teacher monitor via heartbeat
      apiRequest("/submissions/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          exam_id: examId,
          cheat_flags: { total_strikes: updated.length, events: updated },
        }),
      }).catch((err) => console.error("Heartbeat sync error:", err));

      return updated;
    });

    setLastViolationReason(reason);
    setShowWarningModal(true);
  }, [isSubmitting, hasStartedSession, storagePrefix, examId]);

  useExamSecurity(handleStrike, !loading && !!exam && hasStartedSession);

  // Periodic Heartbeat every 10s during active session
  useEffect(() => {
    if (!hasStartedSession || isSubmitting || isExamClosed) return;

    const interval = setInterval(async () => {
      try {
        const res: any = await apiRequest("/submissions/heartbeat", {
          method: "POST",
          body: JSON.stringify({
            exam_id: examId,
            cheat_flags: { total_strikes: strikes.length, events: strikes },
          }),
        });
        if (res && res.is_active === false) {
          setIsExamClosed(true);
          if (document.fullscreenElement) {
            try {
              await document.exitFullscreen();
            } catch (e) {}
          }
        }
      } catch (err: any) {
        if (err.message && (err.message.includes("closed") || err.message.includes("403"))) {
          setIsExamClosed(true);
          if (document.fullscreenElement) {
            try {
              await document.exitFullscreen();
            } catch (e) {}
          }
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [hasStartedSession, isSubmitting, isExamClosed, examId, strikes]);

  // Fullscreen Lockdown Event Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreenActive(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && hasStartedSession && !isSubmitting && !isExamClosed) {
        handleStrike("Exited mandatory fullscreen mode");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [hasStartedSession, isSubmitting, isExamClosed, handleStrike]);

  const requestFullscreenAndStart = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreenActive(true);
      setHasStartedSession(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(`${storagePrefix}_started`, "true");
      }

      // Register session start in backend for live teacher monitoring
      apiRequest("/submissions/start-session", {
        method: "POST",
        body: JSON.stringify({ exam_id: examId }),
      }).catch((err: any) => {
        console.error("Failed to register start-session:", err);
        if (err.message && (err.message.includes("closed") || err.message.includes("403"))) {
          setIsExamClosed(true);
        }
      });
    } catch (e) {
      alert("Fullscreen permission is required to enter the secure examination environment.");
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [qId]: val,
      };
      // Auto-save to localStorage to survive session cuts
      if (typeof window !== "undefined") {
        localStorage.setItem(`${storagePrefix}_answers`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleSelectQuestion = (idx: number) => {
    setCurrentQIndex(idx);
    if (typeof window !== "undefined") {
      localStorage.setItem(`${storagePrefix}_curr_q`, String(idx));
    }
  };

  const clearSessionStorage = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`${storagePrefix}_q_order`);
      localStorage.removeItem(`${storagePrefix}_answers`);
      localStorage.removeItem(`${storagePrefix}_strikes`);
      localStorage.removeItem(`${storagePrefix}_curr_q`);
      localStorage.removeItem(`${storagePrefix}_start_time`);
      localStorage.removeItem(`${storagePrefix}_started`);
    }
  };

  const handleSubmitExam = async () => {
    if (isSubmitting) return;
    const confirmSubmit = window.confirm("Are you ready to submit your assessment responses?");
    if (!confirmSubmit) return;

    try {
      setIsSubmitting(true);
      const answerPayload = (exam?.questions || []).map((q) => ({
        question_id: q.id,
        student_answer: answers[q.id] || "",
      }));

      const cheatFlags = {
        total_strikes: strikes.length,
        events: strikes,
      };

      const res = await apiRequest("/submissions/", {
        method: "POST",
        body: JSON.stringify({
          exam_id: examId,
          answers: answerPayload,
          cheat_flags: cheatFlags,
        }),
      });

      // Clear local storage session upon successful submission
      clearSessionStorage();

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      router.push(`/student/result/${res.id}`);
    } catch (err: any) {
      if (err.message && (err.message.includes("closed") || err.message.includes("403"))) {
        setIsExamClosed(true);
      } else {
        alert("Submission error: " + err.message);
      }
      setIsSubmitting(false);
    }
  };

  if (isExamClosed) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="bg-white rounded-lg border border-red-200 p-8 space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto font-bold text-xl">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900">Assessment Concluded</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            The instructor has concluded this assessment early. Responses and further submissions are locked out.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                clearSessionStorage();
                router.push("/student/exams");
              }}
              className="w-full bg-gray-900 hover:bg-black text-white text-xs font-semibold py-2.5 rounded transition"
            >
              Return to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !exam) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center text-gray-500 text-sm">
        Loading assessment environment...
      </div>
    );
  }

  // Pre-Exam Fullscreen Gate Screen
  if (!hasStartedSession) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6 shadow-sm">
          <div className="space-y-2 text-center border-b border-gray-100 pb-6">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
              Secure Assessment Room
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{exam.title}</h1>
            <p className="text-xs text-gray-500 max-w-lg mx-auto leading-relaxed">
              {exam.description || "Please review the strict assessment security protocols below before beginning."}
            </p>
          </div>

          <div className="space-y-3 text-xs text-gray-700 bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 uppercase tracking-wider text-[11px]">
              Examination Protocols & Security Rules:
            </h3>
            <ul className="space-y-2 list-disc list-inside text-gray-600">
              <li>
                <strong className="text-gray-900">Timing Mode: </strong>
                {exam.timer_mode === "GLOBAL" ? "Synchronized Global Clock" : `Local Clock (${exam.duration_minutes} minutes from start)`}
              </li>
              <li>
                <strong className="text-gray-900">Mandatory Fullscreen: </strong>
                The exam is conducted in strict fullscreen mode. Exiting fullscreen will lock the exam and log an anti-cheat strike.
              </li>
              <li>
                <strong className="text-gray-900">Clipboard & Shortcut Lock: </strong>
                Copying, pasting, cutting, and right-clicking are strictly disabled throughout the session.
              </li>
              <li>
                <strong className="text-gray-900">Session Persistence: </strong>
                Your drafts are continuously saved locally in case of sudden network disconnection.
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={requestFullscreenAndStart}
              className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-lg font-semibold text-sm transition shadow"
            >
              Enter Fullscreen & Begin Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = exam.questions && exam.questions.length > 0 ? exam.questions[currentQIndex] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* Strict Fullscreen Exit Lockdown Overlay Barrier */}
      {!isFullscreenActive && hasStartedSession && !isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-8 text-center space-y-5 border border-red-200 shadow-2xl">
            <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">
                Fullscreen Required — Examination Locked
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                You have exited fullscreen mode. All questions and submission controls are locked until fullscreen is restored. An anti-cheat strike has been logged.
              </p>
            </div>

            <button
              onClick={requestFullscreenAndStart}
              className="w-full bg-gray-900 hover:bg-black text-white text-xs font-semibold py-2.5 rounded transition"
            >
              Return to Fullscreen to Resume Assessment
            </button>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Assessment Session
          </span>
          <h1 className="text-lg font-bold text-gray-900">{exam.title}</h1>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <ExamTimer
            durationMinutes={exam.duration_minutes}
            onTimeUp={handleSubmitExam}
            storageKey={storagePrefix}
            timerMode={exam.timer_mode || "LOCAL"}
            scheduledStartTime={exam.scheduled_start_time}
            scheduledEndTime={exam.scheduled_end_time}
          />

          {strikes.length > 0 && (
            <div className="text-xs font-semibold px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200">
              {strikes.length} Security {strikes.length === 1 ? "Strike" : "Strikes"}
            </div>
          )}

          <button
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded transition disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit Examination"}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left: Question Navigation Sidebar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Questions
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              {Object.keys(answers).filter(k => !!answers[k]?.trim()).length}/{exam.questions.length} answered
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-3 gap-2">
            {exam.questions.map((q, idx) => {
              const isAnswered = !!answers[q.id]?.trim();
              const isCurrent = idx === currentQIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => handleSelectQuestion(idx)}
                  className={`p-2 rounded text-xs font-medium transition flex flex-col items-center justify-center border ${
                    isCurrent
                      ? "border-gray-900 bg-gray-900 text-white"
                      : isAnswered
                      ? "border-gray-300 bg-gray-100 text-gray-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>Q{idx + 1}</span>
                  <span className="text-[10px] opacity-75">{q.type === "CODE_DOC" ? "Doc" : "MCQ"}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Active Question Workspace */}
        <div className="lg:col-span-3 space-y-4">
          {currentQuestion && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Question Header */}
              <div className="border-b border-gray-100 pb-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                      Question {currentQIndex + 1}
                    </span>
                    <span className="text-xs text-gray-500">
                      {currentQuestion.type === "CODE_DOC" ? "Logic & Code Document" : "Multiple Choice"}
                    </span>
                  </div>
                  <h2 className="text-base font-medium text-gray-900 leading-relaxed whitespace-pre-line pt-1">
                    {currentQuestion.prompt}
                  </h2>
                </div>
                <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded border border-gray-200 flex-shrink-0 ml-4">
                  {currentQuestion.max_marks} Marks
                </span>
              </div>

              {/* Question Input Workspace */}
              {currentQuestion.type === "MCQ" ? (
                <McqCard
                  options={currentQuestion.mcq_options || []}
                  selectedOption={answers[currentQuestion.id] || ""}
                  onChange={(val) => handleAnswerChange(currentQuestion.id, val)}
                />
              ) : (
                <div className="space-y-2">
                  <CodeDocEditor
                    value={answers[currentQuestion.id] || ""}
                    onChange={(val) => handleAnswerChange(currentQuestion.id, val)}
                    maxMarks={currentQuestion.max_marks}
                  />
                  <p className="text-xs text-gray-400">
                    Draft your thoughts and code cleanly. Minor typos or omitted imports are not penalized.
                  </p>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs font-medium">
                <button
                  type="button"
                  disabled={currentQIndex === 0}
                  onClick={() => handleSelectQuestion(currentQIndex - 1)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Previous
                </button>

                {currentQIndex < exam.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => handleSelectQuestion(currentQIndex + 1)}
                    className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black transition"
                  >
                    Next Question
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmitExam}
                    className="px-4 py-2 bg-gray-900 text-white rounded hover:bg-black transition"
                  >
                    Submit Exam
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SecurityWarningModal
        isOpen={showWarningModal}
        strikeCount={strikes.length}
        lastReason={lastViolationReason}
        onDismiss={() => setShowWarningModal(false)}
      />
    </div>
  );
}
