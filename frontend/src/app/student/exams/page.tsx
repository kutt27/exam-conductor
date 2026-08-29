"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  is_active: boolean;
  questions: any[];
}

interface Submission {
  id: string;
  exam_id: string;
  status: string;
  total_score: number;
  submitted_at: string;
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [examsData, subsData] = await Promise.all([
          apiRequest<Exam[]>("/exams"),
          apiRequest<Submission[]>("/submissions/my"),
        ]);
        setExams(examsData);
        setSubmissions(subsData);
      } catch (err) {
        console.error("Failed to load student data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getSubmissionForExam = (examId: string) => {
    return submissions.find((s) => s.exam_id === examId);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading examination schedule...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Available Examinations</h1>
        <p className="text-xs text-gray-500 mt-1">
          Select an active assessment below. Fullscreen security monitoring is active during each session.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {exams.map((exam) => {
          const sub = getSubmissionForExam(exam.id);

          return (
            <div
              key={exam.id}
              className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col justify-between hover:border-gray-300 transition"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                    {exam.questions?.length || 0} Questions
                  </span>
                  <span className="text-gray-500">
                    Duration: {exam.duration_minutes} min
                  </span>
                </div>

                <h3 className="text-base font-semibold text-gray-900">{exam.title}</h3>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {exam.description || "No specific instructions provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100 mt-4 flex items-center justify-between">
                {sub ? (
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                      {sub.status === "EVALUATED" ? `Completed: ${sub.total_score} Marks` : "Evaluation in Progress"}
                    </span>

                    <Link
                      href={`/student/result/${sub.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800 underline ml-2"
                    >
                      View Report
                    </Link>
                  </div>
                ) : (
                  <Link
                    href={`/student/exam/${exam.id}`}
                    className="w-full text-center bg-gray-900 hover:bg-black text-white font-medium py-2 px-4 rounded text-xs transition"
                  >
                    Start Examination
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {exams.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-500">
          No active assessments scheduled at this time.
        </div>
      )}
    </div>
  );
}
