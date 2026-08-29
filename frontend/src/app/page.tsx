"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { user, login } = useAuth();
  const router = useRouter();

  const handleQuickLogin = async (email: string, role: string) => {
    try {
      await login(email, `${role.toLowerCase()}123`);
      if (role === "STUDENT") router.push("/student/exams");
      else if (role === "TEACHER") router.push("/teacher/dashboard");
      else if (role === "ADMIN") router.push("/admin/users");
    } catch (err: any) {
      alert("Please ensure backend server is running: " + err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Assessment & Examination Platform
        </h1>

        <p className="text-base text-gray-600 leading-relaxed">
          Supervised examination software for technical logic and algorithm assessment with document-based writing, anti-cheat detection, and structured evaluation.
        </p>

        {user ? (
          <div className="flex justify-center space-x-3 pt-4">
            {user.role === "STUDENT" && (
              <Link
                href="/student/exams"
                className="bg-gray-900 hover:bg-black text-white text-sm font-medium px-5 py-2.5 rounded-md transition"
              >
                Go to Examination Portal
              </Link>
            )}
            {user.role === "TEACHER" && (
              <Link
                href="/teacher/dashboard"
                className="bg-gray-900 hover:bg-black text-white text-sm font-medium px-5 py-2.5 rounded-md transition"
              >
                Go to Teacher Dashboard
              </Link>
            )}
            {user.role === "ADMIN" && (
              <Link
                href="/admin/users"
                className="bg-gray-900 hover:bg-black text-white text-sm font-medium px-5 py-2.5 rounded-md transition"
              >
                Go to Admin Console
              </Link>
            )}
          </div>
        ) : (
          <div className="pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick Role Login:
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                onClick={() => handleQuickLogin("student@exam.com", "STUDENT")}
                className="bg-white hover:bg-gray-50 text-gray-800 text-xs font-medium px-4 py-2 rounded border border-gray-300 shadow-2xs transition"
              >
                Student (Alex)
              </button>

              <button
                onClick={() => handleQuickLogin("teacher@exam.com", "TEACHER")}
                className="bg-white hover:bg-gray-50 text-gray-800 text-xs font-medium px-4 py-2 rounded border border-gray-300 shadow-2xs transition"
              >
                Teacher (Prof. Turing)
              </button>

              <button
                onClick={() => handleQuickLogin("admin@exam.com", "ADMIN")}
                className="bg-white hover:bg-gray-50 text-gray-800 text-xs font-medium px-4 py-2 rounded border border-gray-300 shadow-2xs transition"
              >
                Admin Console
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature Pillar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
        <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-2">
          <h3 className="font-semibold text-base text-gray-900">Document-Style Logic Editor</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Clean white workspace with standard Tab indentation, line numbers, and spellcheck suppression for drafting logic and pseudocode.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-2">
          <h3 className="font-semibold text-base text-gray-900">Exam Integrity Telemetry</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Real-time lockouts for clipboard operations and context menus, paired with automated audit trails for window blur and fullscreen changes.
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-2">
          <h3 className="font-semibold text-base text-gray-900">Instructor Review & Grading</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Side-by-side review workspace with automated rubric breakdowns, mental test traces, and instructor score overrides.
          </p>
        </div>
      </div>
    </div>
  );
}
