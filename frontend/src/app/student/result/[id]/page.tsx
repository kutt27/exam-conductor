"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function StudentResultPage() {
  const params = useParams();
  const submissionId = params.id as string;
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchResult = async () => {
    try {
      const data = await apiRequest(`/submissions/${submissionId}`);
      setSubmission(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
    const interval = setInterval(() => {
      // Auto-poll if still in pending evaluation or actively evaluating
      if (submission?.status === "PENDING_EVALUATION" || submission?.status === "EVALUATING" || submission?.status === "SUBMITTED") {
        fetchResult();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [submissionId, submission?.status]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading evaluation report...
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Submission not found.
      </div>
    );
  }

  const isPending = submission.status === "PENDING_EVALUATION" || submission.status === "SUBMITTED";
  const isEvaluating = submission.status === "EVALUATING";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/student/exams"
        className="text-xs font-medium text-gray-600 hover:text-gray-900 transition"
      >
        ← Back to My Exams
      </Link>

      {/* Score / Status Banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Assessment Status
          </span>
          <h1 className="text-xl font-bold text-gray-900">
            {isPending ? "Submission Received — Queued for Evaluation" : isEvaluating ? "Evaluation in Progress" : "Assessment Evaluation Report"}
          </h1>
          <p className="text-xs text-gray-500">
            Submission ID: {submission.id}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-center min-w-[150px]">
          <span className="text-xs text-gray-500 block">Total Score</span>
          <div className="text-xl font-bold text-gray-900 mt-0.5">
            {isPending ? (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Pending Batch Eval
              </span>
            ) : isEvaluating ? (
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                Evaluating...
              </span>
            ) : (
              <span>{submission.total_score} Marks</span>
            )}
          </div>
        </div>
      </div>

      {/* Pending Notice Box */}
      {isPending && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 space-y-1">
          <p className="font-semibold">Your responses have been securely recorded.</p>
          <p className="text-amber-800 leading-relaxed">
            This assessment uses instructor-managed batch evaluation to ensure fair and balanced grading. Once your instructor triggers the evaluation batch, your scores and detailed rubric feedback will appear here automatically.
          </p>
        </div>
      )}

      {/* Security note if strikes occurred */}
      {submission.cheat_flags?.total_strikes > 0 && (
        <div className="bg-red-50/60 border border-red-200 rounded-lg p-3 text-xs text-red-900">
          <span className="font-semibold">Security Audit Note: </span>
          {submission.cheat_flags.total_strikes} security event(s) recorded during your session.
        </div>
      )}

      {/* Question by question feedback */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Submitted Answers
        </h3>

        {submission.answers?.map((ans: any, idx: number) => {
          const q = ans.question;
          const fb = ans.llm_feedback;
          const score = ans.teacher_override_score !== null && ans.teacher_override_score !== undefined
            ? ans.teacher_override_score
            : ans.auto_score;

          return (
            <div
              key={ans.id}
              className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
            >
              <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                <div>
                  <span className="text-xs font-semibold text-gray-500">Question {idx + 1}</span>
                  <h4 className="font-medium text-gray-900 text-sm mt-0.5 whitespace-pre-line">{q?.prompt}</h4>
                </div>
                <span className="text-xs font-semibold text-gray-900 bg-gray-100 px-2.5 py-1 rounded border border-gray-200 ml-4 flex-shrink-0">
                  {submission.status === "EVALUATED" ? `${score} / ${q?.max_marks} Marks` : `${q?.max_marks} Marks`}
                </span>
              </div>

              {/* Student's Answer in Google Docs white style */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500">Your Response</span>
                <div className="p-4 bg-white border border-gray-300 text-gray-900 font-mono text-xs rounded whitespace-pre-wrap leading-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  {ans.student_answer || "(No response submitted)"}
                </div>
              </div>

              {/* Rubric Feedback (Only when evaluated) */}
              {fb && (
                <div className="bg-gray-50 border border-gray-200 rounded p-4 space-y-3 text-xs">
                  <span className="font-semibold text-gray-900 block">Feedback & Rubric Breakdown</span>

                  {fb.student_constructive_feedback && (
                    <p className="text-gray-700 leading-relaxed">
                      {fb.student_constructive_feedback}
                    </p>
                  )}

                  {fb.passed_mental_test_cases?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {fb.passed_mental_test_cases.map((t: string, i: number) => (
                        <div key={i} className="text-gray-700">
                          <span className="font-medium text-emerald-700 mr-1.5">[Pass]</span>
                          {t}
                        </div>
                      ))}
                    </div>
                  )}

                  {fb.failed_mental_test_cases?.length > 0 && (
                    <div className="space-y-1">
                      {fb.failed_mental_test_cases.map((t: string, i: number) => (
                        <div key={i} className="text-gray-700">
                          <span className="font-medium text-red-700 mr-1.5">[Fail]</span>
                          {t}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Teacher custom feedback */}
              {ans.teacher_feedback && (
                <div className="bg-blue-50/50 border border-blue-200 rounded p-3 text-xs text-blue-950">
                  <span className="font-semibold">Instructor Note: </span>
                  {ans.teacher_feedback}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
