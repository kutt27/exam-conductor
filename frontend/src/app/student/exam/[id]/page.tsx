"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
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
  questions: Question[];
}

export default function StudentExamRunnerPage() {
  const params = useParams();
  const examId = params.id as string;
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Anti-cheat state
  const [strikes, setStrikes] = useState<Array<{ reason: string; timestamp: string }>>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastViolationReason, setLastViolationReason] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    async function loadExam() {
      try {
        const data = await apiRequest<ExamDetail>(`/exams/student/${examId}`);
        setExam(data);
      } catch (err: any) {
        alert("Failed to load exam: " + err.message);
        router.push("/student/exams");
      } finally {
        setLoading(false);
      }
    }
    loadExam();
  }, [examId, router]);

  const handleStrike = (reason: string) => {
    if (isSubmitting) return;

    const event = {
      reason,
      timestamp: new Date().toISOString(),
    };
    setStrikes((prev) => [...prev, event]);
    setLastViolationReason(reason);
    setShowWarningModal(true);
  };

  useExamSecurity(handleStrike, !loading && !!exam);

  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (e) {
      console.warn("Fullscreen request not granted");
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
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

      const res = await apiRequest("/submissions", {
        method: "POST",
        body: JSON.stringify({
          exam_id: examId,
          answers: answerPayload,
          cheat_flags: cheatFlags,
        }),
      });

      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      router.push(`/student/result/${res.id}`);
    } catch (err: any) {
      alert("Submission error: " + err.message);
      setIsSubmitting(false);
    }
  };

  if (loading || !exam) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center text-gray-500 text-sm">
        Loading assessment environment...
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
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
          />

          {!isFullscreen && (
            <button
              onClick={requestFullscreen}
              className="text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 transition"
            >
              Fullscreen
            </button>
          )}

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
                  onClick={() => setCurrentQIndex(idx)}
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
                  onClick={() => setCurrentQIndex((prev) => prev - 1)}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Previous
                </button>

                {currentQIndex < exam.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => prev + 1)}
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
