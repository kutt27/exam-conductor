"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    try {
      const [usersList, statsData] = await Promise.all([
        apiRequest<any[]>("/admin/users"),
        apiRequest<any>("/admin/stats"),
      ]);
      setUsers(usersList);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, full_name: fullName, password, role }),
      });
      setEmail("");
      setFullName("");
      setPassword("");
      loadData();
    } catch (err: any) {
      alert("Failed to create user: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      loadData();
    } catch (err: any) {
      alert("Failed to update role: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading admin console...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">Administration Console</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage user accounts, roles, and review platform usage statistics.</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 font-medium">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_users}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 font-medium">Instructors</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_teachers}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 font-medium">Students</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_students}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-500 font-medium">Assessments</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_exams}</p>
          </div>
        </div>
      )}

      {/* Grid: Create User & User Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create User Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 h-fit">
          <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
            Provision New Account
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Smith"
                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="smith@exam.com"
                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-gray-900 focus:outline-none"
              >
                <option value="TEACHER">Teacher</option>
                <option value="STUDENT">Student</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full bg-gray-900 hover:bg-black text-white text-xs font-medium py-2 rounded transition"
            >
              {creating ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* Users Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
              Registered Accounts ({users.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 uppercase tracking-wider font-semibold">
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="p-3.5">
                      <p className="font-semibold text-gray-900">{u.full_name}</p>
                      <p className="text-[11px] text-gray-400">{u.email}</p>
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : u.role === "TEACHER"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                      >
                        <option value="STUDENT">STUDENT</option>
                        <option value="TEACHER">TEACHER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
