"use client";

import React, { useState } from "react";
import { apiRequest } from "@/lib/api";

interface RubricBreakdownCardProps {
  answerId: string;
  maxMarks: number;
  autoScore: number;
  llmFeedback?: {
    logic_correctness_score?: number;
    syntax_resilience_score?: number;
    edge_case_score?: number;
    total_awarded_marks?: number;
    passed_mental_test_cases?: string[];
    failed_mental_test_cases?: string[];
    teacher_summary?: string;
    student_constructive_feedback?: string;
  } | null;
  currentOverrideScore?: number | null;
  currentTeacherFeedback?: string | null;
  onSaved?: () => void;
}

export function RubricBreakdownCard({
  answerId,
  maxMarks,
  autoScore,
  llmFeedback,
  currentOverrideScore,
  currentTeacherFeedback,
  onSaved,
}: RubricBreakdownCardProps) {
  const [overrideScore, setOverrideScore] = useState<string>(
    currentOverrideScore !== null && currentOverrideScore !== undefined
      ? String(currentOverrideScore)
      : ""
  );
  const [feedback, setFeedback] = useState<string>(currentTeacherFeedback || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveOverride = async () => {
    if (overrideScore === "" || isNaN(Number(overrideScore))) return;

    try {
      setIsSaving(true);
      await apiRequest(`/review/answer/${answerId}/override`, {
        method: "PATCH",
        body: JSON.stringify({
          teacher_override_score: Number(overrideScore),
          teacher_feedback: feedback,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err) {
      alert("Failed to save score override");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 text-sm">
          Automated Rubric Evaluation
        </h4>
        <div className="text-right">
          <span className="text-xs text-gray-500 mr-2">Evaluated Score:</span>
          <span className="font-semibold text-gray-900 bg-white px-2.5 py-0.5 rounded border border-gray-300 text-xs">
            {autoScore} / {maxMarks} Marks
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4 text-sm">
        {llmFeedback ? (
          <>
            {/* Sub-score grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <p className="text-[11px] text-gray-500 font-medium">Logic (60%)</p>
                <p className="font-semibold text-gray-900 text-base mt-0.5">
                  {llmFeedback.logic_correctness_score ?? 0}
                </p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <p className="text-[11px] text-gray-500 font-medium">Syntax (20%)</p>
                <p className="font-semibold text-gray-900 text-base mt-0.5">
                  {llmFeedback.syntax_resilience_score ?? 0}
                </p>
              </div>
              <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
                <p className="text-[11px] text-gray-500 font-medium">Edge Cases (20%)</p>
                <p className="font-semibold text-gray-900 text-base mt-0.5">
                  {llmFeedback.edge_case_score ?? 0}
                </p>
              </div>
            </div>

            {/* Mental Test Traces */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Trace Analysis
              </p>
              {llmFeedback.passed_mental_test_cases && llmFeedback.passed_mental_test_cases.length > 0 && (
                <div className="space-y-1">
                  {llmFeedback.passed_mental_test_cases.map((t, idx) => (
                    <div key={idx} className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                      <span className="font-medium text-emerald-700 mr-1.5">[Pass]</span>
                      {t}
                    </div>
                  ))}
                </div>
              )}
              {llmFeedback.failed_mental_test_cases && llmFeedback.failed_mental_test_cases.length > 0 && (
                <div className="space-y-1">
                  {llmFeedback.failed_mental_test_cases.map((t, idx) => (
                    <div key={idx} className="text-xs text-gray-700 bg-red-50/50 p-2 rounded border border-red-200">
                      <span className="font-medium text-red-700 mr-1.5">[Fail]</span>
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summaries */}
            {llmFeedback.teacher_summary && (
              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs">
                <span className="font-semibold text-gray-900">Summary: </span>
                <span className="text-gray-700">{llmFeedback.teacher_summary}</span>
              </div>
            )}
            {llmFeedback.student_constructive_feedback && (
              <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs">
                <span className="font-semibold text-gray-900">Candidate Guidance: </span>
                <span className="text-gray-700">{llmFeedback.student_constructive_feedback}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500 italic py-2">
            No rubric breakdown recorded for this question (e.g. MCQ or pending evaluation).
          </p>
        )}

        {/* Teacher Manual Score Override Section */}
        <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
              Score Adjustment & Notes
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <label className="text-xs text-gray-600 font-medium">Override Score:</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max={maxMarks}
              value={overrideScore}
              onChange={(e) => setOverrideScore(e.target.value)}
              placeholder={String(autoScore)}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm font-semibold focus:ring-1 focus:ring-gray-900 focus:outline-none"
            />
            <span className="text-xs text-gray-500">/ {maxMarks} Marks</span>
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Add instructor comments for the candidate..."
            rows={2}
            className="w-full text-xs p-2.5 border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1">
            {saveSuccess ? (
              <span className="text-xs text-emerald-700 font-medium">
                Changes saved successfully
              </span>
            ) : <span />}

            <button
              onClick={handleSaveOverride}
              disabled={isSaving}
              className="bg-gray-900 hover:bg-black text-white text-xs font-medium px-4 py-2 rounded transition"
            >
              {isSaving ? "Saving..." : "Save Override"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
