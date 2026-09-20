"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-semibold text-base tracking-tight text-gray-900">
                Exam Conductor
              </span>
            </Link>

            {user && (
              <div className="hidden md:flex items-center space-x-4 text-sm">
                {user.role === "TEACHER" && (
                  <Link
                    href="/teacher/dashboard"
                    className="text-gray-600 hover:text-gray-900 font-medium transition"
                  >
                    Dashboard
                  </Link>
                )}
                {user.role === "ADMIN" && (
                  <>
                    <Link
                      href="/teacher/dashboard"
                      className="text-gray-600 hover:text-gray-900 font-medium transition"
                    >
                      All Exams
                    </Link>
                    <Link
                      href="/admin/users"
                      className="text-gray-600 hover:text-gray-900 font-medium transition"
                    >
                      Admin
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3 text-sm">
                <div className="text-right hidden sm:flex sm:flex-col justify-center">
                  <span className="text-xs font-semibold text-gray-900 leading-none">{user.full_name}</span>
                  <span className="text-[11px] text-gray-500 leading-none mt-0.5">{user.email}</span>
                </div>
                
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                  user.role === "ADMIN"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : user.role === "TEACHER"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-gray-100 text-gray-700 border-gray-200"
                }`}>
                  {user.role}
                </span>

                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-500 hover:text-gray-900 font-medium px-2 py-1 rounded hover:bg-gray-100 transition"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3 text-sm">
                <Link
                  href="/login"
                  className="text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 transition"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="bg-gray-900 hover:bg-black text-white px-3.5 py-1.5 rounded-md font-medium text-sm transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
