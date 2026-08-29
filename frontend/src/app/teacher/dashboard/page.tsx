"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function TeacherDashboardPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExams() {
      try {
        const examsData = await apiRequest<any[]>("/exams");
        setExams(examsData);
        if (examsData.length > 0) {
          setSelectedExamId(examsData[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadExams();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    async function loadSubmissions() {
      try {
        const subs = await apiRequest<any[]>(`/review/exam/${selectedExamId}/submissions`);
        setSubmissions(subs);
      } catch (err) {
        console.error(err);
      }
    }
    loadSubmissions();
  }, [selectedExamId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading instructor portal...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Instructor Evaluation Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage assessments, review candidate logic evaluations, and audit telemetry.
          </p>
        </div>

        <Link
          href="/teacher/exam/new"
          className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded transition text-center"
        >
          Create Assessment
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Exam list */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 h-fit">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Assessments ({exams.length})
          </h3>

          <div className="space-y-1.5">
            {exams.map((ex) => {
              const isSelected = ex.id === selectedExamId;
              return (
                <button
                  key={ex.id}
                  onClick={() => setSelectedExamId(ex.id)}
                  className={`w-full text-left p-3 rounded border transition text-xs ${
                    isSelected
                      ? "border-gray-900 bg-gray-50 font-medium text-gray-900"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <h4 className="line-clamp-1">{ex.title}</h4>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                    <span>{ex.questions?.length || 0} Questions</span>
                    <span>{ex.duration_minutes} min</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Submissions Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Candidate Submissions ({submissions.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 uppercase tracking-wider font-semibold">
                  <th className="p-3.5">Candidate</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Security Strikes</th>
                  <th className="p-3.5">Score</th>
                  <th className="p-3.5 text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((sub) => {
                  const strikesCount = sub.cheat_flags?.total_strikes || 0;

                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-3.5">
                        <p className="font-semibold text-gray-900">{sub.student?.full_name || "Candidate"}</p>
                        <p className="text-[11px] text-gray-400">{sub.student?.email}</p>
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          sub.status === "EVALUATED"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}>
                          {sub.status}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {strikesCount > 0 ? (
                          <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 font-medium">
                            {strikesCount} Strikes
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      <td className="p-3.5 font-semibold text-gray-900">
                        {sub.total_score} Marks
                      </td>

                      <td className="p-3.5 text-right">
                        <Link
                          href={`/teacher/review/${sub.id}`}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-xs font-medium border border-gray-300 transition"
                        >
                          Review & Grade
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {submissions.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-xs">
                No candidate submissions recorded for this assessment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
