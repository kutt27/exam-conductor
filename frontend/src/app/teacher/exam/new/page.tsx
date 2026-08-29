"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface NewQuestion {
  type: "MCQ" | "CODE_DOC";
  prompt: string;
  max_marks: number;
  mcq_options: string[];
  mcq_correct_key: string;
  rubric_notes: string;
}

export default function CreateExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [questions, setQuestions] = useState<NewQuestion[]>([
    {
      type: "MCQ",
      prompt: "What is the worst-case time complexity of QuickSort?",
      max_marks: 5,
      mcq_options: ["A) O(N)", "B) O(N log N)", "C) O(N^2)", "D) O(1)"],
      mcq_correct_key: "C",
      rubric_notes: "",
    },
    {
      type: "CODE_DOC",
      prompt: "Write a function `is_palindrome(s: str) -> bool` that checks if a string is a palindrome ignoring cases and non-alphanumeric characters. Explain edge cases and time/space complexity.",
      max_marks: 15,
      mcq_options: [],
      mcq_correct_key: "",
      rubric_notes: "Award full marks for two-pointer approach with O(1) extra space. Check for empty strings and single characters.",
    },
  ]);
  const [saving, setSaving] = useState(false);

  const addQuestion = (type: "MCQ" | "CODE_DOC") => {
    setQuestions((prev) => [
      ...prev,
      {
        type,
        prompt: "",
        max_marks: type === "MCQ" ? 5 : 15,
        mcq_options: type === "MCQ" ? ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"] : [],
        mcq_correct_key: type === "MCQ" ? "A" : "",
        rubric_notes: "",
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof NewQuestion, val: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || questions.length === 0) {
      alert("Please provide a title and at least one question.");
      return;
    }

    try {
      setSaving(true);
      await apiRequest("/exams", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          duration_minutes: durationMinutes,
          is_active: true,
          questions: questions.map((q, idx) => ({
            ...q,
            order_index: idx + 1,
          })),
        }),
      });
      router.push("/teacher/dashboard");
    } catch (err: any) {
      alert("Failed to create exam: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/teacher/dashboard"
        className="text-xs font-medium text-gray-600 hover:text-gray-900 transition"
      >
        ← Back to Dashboard
      </Link>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Exam Metadata */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Assessment Information</h2>

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

          <div>
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
          {saving ? "Publishing Assessment..." : "Publish Assessment"}
        </button>
      </form>
    </div>
  );
}
