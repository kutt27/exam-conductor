"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { RubricBreakdownCard } from "@/components/teacher/RubricBreakdownCard";

export default function TeacherReviewPage() {
  const params = useParams();
  const submissionId = params.id as string;
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSubmission = async () => {
    try {
      const data = await apiRequest(`/review/submission/${submissionId}`);
      setSubmission(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmission();
  }, [submissionId]);

  if (loading || !submission) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading candidate submission data...
      </div>
    );
  }

  const strikes = submission.cheat_flags?.events || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/teacher/dashboard"
        className="text-xs font-medium text-gray-600 hover:text-gray-900 transition"
      >
        ← Back to Teacher Dashboard
      </Link>

      {/* Header Info Banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span>Candidate Evaluation</span>
            <span>•</span>
            <span>{submission.exam?.title}</span>
          </div>

          <h1 className="text-xl font-bold text-gray-900">
            {submission.student?.full_name}{" "}
            <span className="text-sm font-normal text-gray-500">({submission.student?.email})</span>
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {/* Security status */}
          <div className={`px-3 py-1.5 rounded border text-xs font-medium ${
            strikes.length > 0
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-gray-50 text-gray-700 border-gray-200"
          }`}>
            {strikes.length > 0 ? `${strikes.length} Security Strikes Recorded` : "Clean Session (0 Strikes)"}
          </div>

          {/* Total Score */}
          <div className="bg-gray-900 text-white px-4 py-1.5 rounded text-center">
            <span className="text-[10px] uppercase font-semibold text-gray-400 block">Total Score</span>
            <span className="text-base font-bold text-white">{submission.total_score} Marks</span>
          </div>
        </div>
      </div>

      {/* Security Telemetry Audit Trail (if any strikes) */}
      {strikes.length > 0 && (
        <div className="bg-red-50/60 border border-red-200 rounded-lg p-4 space-y-2">
          <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wider">
            Security Telemetry Audit Trail
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {strikes.map((s: any, idx: number) => (
              <div key={idx} className="bg-white p-2.5 rounded border border-red-100">
                <p className="font-medium text-gray-900">{s.reason}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(s.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split-Screen Review Section */}
      <div className="space-y-8">
        {submission.answers?.map((ans: any, idx: number) => {
          const q = ans.question;

          return (
            <div key={ans.id} className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold bg-gray-900 text-white px-2 py-0.5 rounded">
                  Q{idx + 1}
                </span>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {q?.type === "CODE_DOC" ? "Logic & Code Document" : "Multiple Choice Question"}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left Side: Prompt & Candidate's White Google Docs Style Answer */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Problem Statement
                    </h3>
                    <p className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">
                      {q?.prompt}
                    </p>
                  </div>

                  {q?.rubric_notes && (
                    <div className="bg-gray-50 p-2.5 rounded border border-gray-200 text-xs">
                      <span className="font-semibold text-gray-700">Evaluation Rubric: </span>
                      <span className="text-gray-600">{q.rubric_notes}</span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Candidate&apos;s Submitted Response
                    </h3>
                    {/* Google Docs White Paper Box */}
                    <div className="bg-white border border-gray-300 p-5 rounded font-mono text-xs text-gray-900 shadow-[0_1px_3px_0_rgba(60,64,67,0.08)] whitespace-pre-wrap leading-6">
                      {ans.student_answer || "(No response provided)"}
                    </div>
                  </div>
                </div>

                {/* Right Side: Structured Rubric Breakdown & Score Override */}
                <div>
                  <RubricBreakdownCard
                    answerId={ans.id}
                    maxMarks={q?.max_marks || 10}
                    autoScore={ans.auto_score}
                    llmFeedback={ans.llm_feedback}
                    currentOverrideScore={ans.teacher_override_score}
                    currentTeacherFeedback={ans.teacher_feedback}
                    onSaved={loadSubmission}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
