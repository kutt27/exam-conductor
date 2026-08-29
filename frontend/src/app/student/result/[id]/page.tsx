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
      if (submission?.status === "SUBMITTED") {
        fetchResult();
      }
    }, 3000);
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

  const isEvaluating = submission.status === "SUBMITTED";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/student/exams"
        className="text-xs font-medium text-gray-600 hover:text-gray-900 transition"
      >
        ← Back to My Exams
      </Link>

      {/* Score Banner */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Assessment Results
          </span>
          <h1 className="text-xl font-bold text-gray-900">Performance & Feedback Report</h1>
          <p className="text-xs text-gray-500">
            Submission ID: {submission.id}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-center min-w-[140px]">
          <span className="text-xs text-gray-500 block">Total Score</span>
          <div className="text-2xl font-bold text-gray-900 mt-0.5">
            {isEvaluating ? (
              <span className="text-sm font-medium text-amber-600 animate-pulse">Evaluating...</span>
            ) : (
              <span>{submission.total_score} Marks</span>
            )}
          </div>
        </div>
      </div>

      {/* Security note if strikes occurred */}
      {submission.cheat_flags?.total_strikes > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
          <span className="font-semibold">Security Note: </span>
          {submission.cheat_flags.total_strikes} security event(s) recorded during this examination session.
        </div>
      )}

      {/* Question by question feedback */}
      <div className="space-y-6">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Question Responses
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
                  {score} / {q?.max_marks} Marks
                </span>
              </div>

              {/* Student's Answer in Google Docs white style */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-gray-500">Your Submitted Response</span>
                <div className="p-4 bg-gray-50 border border-gray-200 text-gray-900 font-mono text-xs rounded whitespace-pre-wrap leading-relaxed">
                  {ans.student_answer || "(No response submitted)"}
                </div>
              </div>

              {/* Rubric Feedback */}
              {fb && (
                <div className="bg-gray-50 border border-gray-200 rounded p-4 space-y-3 text-xs">
                  <span className="font-semibold text-gray-900 block">Feedback & Evaluation</span>

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
