"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface QuestionDraft {
  id?: string;
  type: "MCQ" | "CODE_DOC";
  prompt: string;
  max_marks: number;
  mcq_options: string[];
  mcq_correct_key: string;
  rubric_notes: string;
}

function ExamEditorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editExamId = searchParams.get("edit");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [accessCode, setAccessCode] = useState(() => "EXAM-" + Math.random().toString(36).substring(2, 6).toUpperCase());
  const [timerMode, setTimerMode] = useState<"LOCAL" | "GLOBAL">("LOCAL");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [scheduledEndTime, setScheduledEndTime] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      type: "MCQ",
      prompt: "What is the average time complexity of searching in a balanced Binary Search Tree?",
      max_marks: 5,
      mcq_options: ["A) O(1)", "B) O(log N)", "C) O(N)", "D) O(N log N)"],
      mcq_correct_key: "B",
      rubric_notes: "",
    },
    {
      type: "CODE_DOC",
      prompt: "Write a function `find_first_unique_char(s: str) -> int` that returns the index of the first non-repeating character in a string, or -1 if none exists.\n\nExplain your approach and time/space complexity.",
      max_marks: 15,
      mcq_options: [],
      mcq_correct_key: "",
      rubric_notes: "Award 10 marks for O(N) frequency map logic. Award 5 marks for clear complexity explanation.",
    },
  ]);

  const [loading, setLoading] = useState(!!editExamId);
  const [saving, setSaving] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState<string | null>(null);

  const draftStorageKey = editExamId ? `exam_draft_${editExamId}` : "teacher_exam_creation_draft";

  // 1. Initial Load: Load either existing exam for editing OR restore local draft
  useEffect(() => {
    async function initExamData() {
      if (editExamId) {
        try {
          const existing = await apiRequest<any>(`/exams/${editExamId}`);
          setTitle(existing.title || "");
          setDescription(existing.description || "");
          setDurationMinutes(existing.duration_minutes || 45);
          setAccessCode(existing.access_code || "");
          setTimerMode(existing.timer_mode || "LOCAL");
          setIsActive(existing.is_active !== false);
          if (existing.scheduled_start_time) {
            setScheduledStartTime(new Date(existing.scheduled_start_time).toISOString().slice(0, 16));
          }
          if (existing.scheduled_end_time) {
            setScheduledEndTime(new Date(existing.scheduled_end_time).toISOString().slice(0, 16));
          }
          if (existing.questions && existing.questions.length > 0) {
            setQuestions(
              existing.questions.map((q: any) => ({
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                max_marks: q.max_marks,
                mcq_options: q.mcq_options || [],
                mcq_correct_key: q.mcq_correct_key || "",
                rubric_notes: q.rubric_notes || "",
              }))
            );
          }
        } catch (err: any) {
          alert("Failed to load existing assessment: " + err.message);
        } finally {
          setLoading(false);
        }
      } else {
        // Check for local creation draft
        if (typeof window !== "undefined") {
          const savedDraftJson = localStorage.getItem("teacher_exam_creation_draft");
          if (savedDraftJson) {
            try {
              const draft = JSON.parse(savedDraftJson);
              if (draft.title) setTitle(draft.title);
              if (draft.description) setDescription(draft.description);
              if (draft.durationMinutes) setDurationMinutes(draft.durationMinutes);
              if (draft.accessCode) setAccessCode(draft.accessCode);
              if (draft.timerMode) setTimerMode(draft.timerMode);
              if (draft.scheduledStartTime) setScheduledStartTime(draft.scheduledStartTime);
              if (draft.scheduledEndTime) setScheduledEndTime(draft.scheduledEndTime);
              if (draft.questions && draft.questions.length > 0) setQuestions(draft.questions);
              setHasRestoredDraft(true);
            } catch (e) {
              console.error("Error restoring draft", e);
            }
          }
        }
        setLoading(false);
      }
    }

    initExamData();
  }, [editExamId]);

  // 2. Auto-save draft changes to localStorage
  useEffect(() => {
    if (loading) return;

    const timeout = setTimeout(() => {
      if (typeof window !== "undefined") {
        const draftData = {
          title,
          description,
          durationMinutes,
          accessCode,
          timerMode,
          scheduledStartTime,
          scheduledEndTime,
          isActive,
          questions,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftStorageKey, JSON.stringify(draftData));
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        setDraftLastSaved(timeStr);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [title, description, durationMinutes, accessCode, timerMode, scheduledStartTime, scheduledEndTime, isActive, questions, loading, draftStorageKey]);

  const clearDraft = () => {
    if (window.confirm("Are you sure you want to discard this draft and reset to default template?")) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(draftStorageKey);
      }
      setTitle("");
      setDescription("");
      setDurationMinutes(45);
      setAccessCode("EXAM-" + Math.random().toString(36).substring(2, 6).toUpperCase());
      setTimerMode("LOCAL");
      setScheduledStartTime("");
      setScheduledEndTime("");
      setQuestions([
        {
          type: "MCQ",
          prompt: "What is the average time complexity of searching in a balanced Binary Search Tree?",
          max_marks: 5,
          mcq_options: ["A) O(1)", "B) O(log N)", "C) O(N)", "D) O(N log N)"],
          mcq_correct_key: "B",
          rubric_notes: "",
        },
        {
          type: "CODE_DOC",
          prompt: "Write a function `find_first_unique_char(s: str) -> int` that returns the index of the first non-repeating character in a string, or -1 if none exists.\n\nExplain your approach and time/space complexity.",
          max_marks: 15,
          mcq_options: [],
          mcq_correct_key: "",
          rubric_notes: "Award 10 marks for O(N) frequency map logic. Award 5 marks for clear complexity explanation.",
        },
      ]);
      setHasRestoredDraft(false);
      setDraftLastSaved(null);
    }
  };

  const regenerateCode = () => {
    setAccessCode("EXAM-" + Math.random().toString(36).substring(2, 6).toUpperCase());
  };

  const addQuestion = (type: "MCQ" | "CODE_DOC") => {
    if (type === "MCQ") {
      setQuestions((prev) => [
        ...prev,
        {
          type: "MCQ",
          prompt: "",
          max_marks: 5,
          mcq_options: ["A) ", "B) ", "C) ", "D) "],
          mcq_correct_key: "A",
          rubric_notes: "",
        },
      ]);
    } else {
      setQuestions((prev) => [
        ...prev,
        {
          type: "CODE_DOC",
          prompt: "",
          max_marks: 10,
          mcq_options: [],
          mcq_correct_key: "",
          rubric_notes: "",
        },
      ]);
    }
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (questions.length === 0) {
      alert("Please add at least one question.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title,
        description,
        duration_minutes: durationMinutes,
        access_code: accessCode.trim().toUpperCase(),
        timer_mode: timerMode,
        is_active: isActive,
        scheduled_start_time: timerMode === "GLOBAL" && scheduledStartTime ? new Date(scheduledStartTime).toISOString() : null,
        scheduled_end_time: timerMode === "GLOBAL" && scheduledEndTime ? new Date(scheduledEndTime).toISOString() : null,
        questions: questions.map((q, idx) => ({
          ...q,
          order_index: idx + 1,
        })),
      };

      if (editExamId) {
        await apiRequest(`/exams/${editExamId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/exams/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      // Clear draft on successful save/publish
      if (typeof window !== "undefined") {
        localStorage.removeItem(draftStorageKey);
      }

      router.push("/teacher/dashboard");
    } catch (err: any) {
      alert("Failed to save assessment: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading assessment editor...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/teacher/dashboard"
          className="text-xs font-medium text-gray-600 hover:text-gray-900 transition"
        >
          ← Back to Dashboard
        </Link>

        <div className="flex items-center space-x-3">
          {draftLastSaved && (
            <span className="text-[11px] text-gray-400 font-mono">
              Auto-saved draft at {draftLastSaved}
            </span>
          )}
          <button
            type="button"
            onClick={clearDraft}
            className="text-xs text-red-600 hover:text-red-800 font-medium transition"
          >
            Reset Draft
          </button>
        </div>
      </div>

      {/* Restored Draft Alert Banner */}
      {hasRestoredDraft && !editExamId && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 flex items-center justify-between">
          <span>Your previous unsaved assessment draft has been restored automatically.</span>
          <button
            onClick={() => setHasRestoredDraft(false)}
            className="text-amber-900 font-bold ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Exam Metadata & Access Code */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              {editExamId ? "Edit Assessment & Questions" : "Assessment Information & Access Code"}
            </h2>
            {editExamId && (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-semibold">
                Editing: {accessCode}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Assessment Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Structures & Algorithms Screening"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min="5"
                max="300"
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Access Code Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Unique Access Code (Required by Candidates)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MATH-101"
                  className="flex-1 px-3 py-2 text-sm uppercase tracking-wider font-mono font-bold border border-gray-300 rounded bg-gray-50 focus:bg-white focus:ring-1 focus:ring-gray-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={regenerateCode}
                  className="px-3 py-2 border border-gray-300 text-xs font-medium rounded hover:bg-gray-50 transition"
                  title="Generate new random code"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>

          {/* Timer Mode Selection */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <label className="block text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Clock & Timing Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTimerMode("LOCAL")}
                className={`p-3.5 rounded border text-left transition ${
                  timerMode === "LOCAL"
                    ? "border-gray-900 bg-gray-50 text-gray-900 ring-1 ring-gray-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                }`}
              >
                <div className="text-xs font-bold">Local Clock (Per Candidate)</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Each candidate receives their own timer ({durationMinutes}m) starting the moment they enter the exam.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTimerMode("GLOBAL")}
                className={`p-3.5 rounded border text-left transition ${
                  timerMode === "GLOBAL"
                    ? "border-gray-900 bg-gray-50 text-gray-900 ring-1 ring-gray-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-600"
                }`}
              >
                <div className="text-xs font-bold">Global Clock (Synchronized)</div>
                <div className="text-[11px] text-gray-500 mt-1">
                  All candidates share the exact same synchronized countdown. Late joiners only receive remaining window.
                </div>
              </button>
            </div>

            {timerMode === "GLOBAL" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded border border-gray-200 mt-2">
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">
                    Scheduled Start (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledStartTime}
                    onChange={(e) => setScheduledStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-700 mb-1">
                    Scheduled End (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledEndTime}
                    onChange={(e) => setScheduledEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-medium text-gray-700 mb-1">Instructions / Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Candidate instructions, policies, and scoring criteria..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Questions Builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Assessment Questions ({questions.length})
            </h3>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => addQuestion("MCQ")}
                className="text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded border border-gray-300 transition"
              >
                + Add Multiple Choice
              </button>
              <button
                type="button"
                onClick={() => addQuestion("CODE_DOC")}
                className="text-xs font-medium bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded transition"
              >
                + Add Document Question
              </button>
            </div>
          </div>

          {questions.map((q, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded">
                  Question {idx + 1}: {q.type === "CODE_DOC" ? "Logic & Code Document" : "Multiple Choice"}
                </span>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1">
                    <label className="text-xs text-gray-500">Marks:</label>
                    <input
                      type="number"
                      min="1"
                      value={q.max_marks}
                      onChange={(e) => updateQuestion(idx, "max_marks", Number(e.target.value))}
                      className="w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center font-semibold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Question Prompt</label>
                <textarea
                  rows={3}
                  required
                  value={q.prompt}
                  onChange={(e) => updateQuestion(idx, "prompt", e.target.value)}
                  placeholder="Describe the logic/coding challenge..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
                />
              </div>

              {q.type === "MCQ" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {q.mcq_options.map((opt, optIdx) => (
                    <input
                      key={optIdx}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...q.mcq_options];
                        newOpts[optIdx] = e.target.value;
                        updateQuestion(idx, "mcq_options", newOpts);
                      }}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
                    />
                  ))}
                  <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                    <label className="text-xs font-medium text-gray-700">Correct Option Key:</label>
                    <input
                      type="text"
                      value={q.mcq_correct_key}
                      onChange={(e) => updateQuestion(idx, "mcq_correct_key", e.target.value)}
                      placeholder="e.g. A"
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded text-center uppercase font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 p-3 rounded space-y-1">
                  <label className="block text-xs font-medium text-gray-700">Evaluation Rubric Guidance</label>
                  <input
                    type="text"
                    value={q.rubric_notes}
                    onChange={(e) => updateQuestion(idx, "rubric_notes", e.target.value)}
                    placeholder="e.g. Expect O(N) complexity. Require edge case handling for empty list and single characters."
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-gray-900 focus:outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gray-900 hover:bg-black text-white font-medium py-2.5 rounded transition text-sm disabled:opacity-50"
        >
          {saving
            ? editExamId
              ? "Saving Changes..."
              : "Publishing Assessment..."
            : editExamId
            ? "Save Changes"
            : "Publish Assessment"}
        </button>
      </form>
    </div>
  );
}

export default function TeacherExamNewPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">Loading editor...</div>}>
      <ExamEditorForm />
    </Suspense>
  );
}
