"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

interface Submission {
  id: string;
  exam_id: string;
  status: string;
  total_score: number;
  submitted_at: string;
  exam?: {
    title: string;
    description: string;
    duration_minutes: number;
  };
}

export default function StudentExamsPage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [searchingCode, setSearchingCode] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubmissions() {
      try {
        const subsData = await apiRequest<Submission[]>("/submissions/my");
        setSubmissions(subsData);
      } catch (err) {
        console.error("Failed to load student submissions", err);
      } finally {
        setLoading(false);
      }
    }
    loadSubmissions();
  }, []);

  const handleAccessCodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    try {
      setSearchingCode(true);
      setCodeError("");
      const cleanCode = accessCode.trim().toUpperCase();
      const exam = await apiRequest(`/exams/code/${cleanCode}`);
      router.push(`/student/exam/${exam.id}`);
    } catch (err: any) {
      setCodeError(err.message || "Invalid or inactive assessment code.");
    } finally {
      setSearchingCode(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Access Code Search Gate */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-5 shadow-2xs text-center">
        <div className="space-y-1.5 max-w-lg mx-auto">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
            Assessment Access Portal
          </span>
          <h1 className="text-xl font-bold text-gray-900">Enter Assessment Access Code</h1>
          <p className="text-xs text-gray-500 leading-relaxed">
            Enter the unique access code provided by your instructor to unlock your assigned examination room.
          </p>
        </div>

        <form onSubmit={handleAccessCodeSearch} className="max-w-md mx-auto space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              required
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                if (codeError) setCodeError("");
              }}
              placeholder="e.g. EXAM-8921"
              className="flex-1 px-4 py-2.5 text-sm uppercase tracking-wider font-mono font-semibold border border-gray-300 rounded text-center focus:ring-1 focus:ring-gray-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={searchingCode || !accessCode.trim()}
              className="bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded text-xs font-semibold transition disabled:opacity-50 flex-shrink-0"
            >
              {searchingCode ? "Unlocking..." : "Enter Exam"}
            </button>
          </div>

          {codeError && (
            <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200 font-medium">
              {codeError}
            </p>
          )}
        </form>
      </div>

      {/* Candidate Past History */}
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Your Completed Assessments ({submissions.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-gray-500">Loading assessment history...</div>
        ) : submissions.length > 0 ? (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-gray-300 transition"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold text-gray-900 text-sm">{sub.exam?.title || "Assessment"}</h3>
                  <p className="text-xs text-gray-400">
                    Submitted: {new Date(sub.submitted_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-1 rounded border text-xs font-medium ${
                    sub.status === "EVALUATED"
                      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
                      : sub.status === "EVALUATING"
                      ? "text-blue-800 bg-blue-50 border-blue-200 animate-pulse"
                      : "text-amber-800 bg-amber-50 border-amber-200"
                  }`}>
                    {sub.status === "EVALUATED"
                      ? `Graded: ${sub.total_score} Marks`
                      : sub.status === "EVALUATING"
                      ? "Evaluating..."
                      : "Pending Evaluation"}
                  </span>

                  <Link
                    href={`/student/result/${sub.id}`}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs font-medium border border-gray-300 transition"
                  >
                    View Report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200 p-6 text-xs text-gray-400">
            No past assessment submissions recorded. Enter an access code above to begin.
          </div>
        )}
      </div>
    </div>
  );
}
