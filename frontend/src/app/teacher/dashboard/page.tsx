"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { apiRequest, API_URL } from "@/lib/api";

interface BatchStatus {
  total: number;
  pending: number;
  evaluating: number;
  evaluated: number;
  failed: number;
  is_evaluating: boolean;
  progress_percent: number;
}

interface StudentCredential {
  id: string;
  full_name: string;
  email: string;
  password?: string;
  role: string;
  created_at: string;
}

interface LiveRosterSummary {
  total_candidates: number;
  in_progress_count: number;
  submitted_count: number;
  not_started_count: number;
  total_strikes: number;
  flagged_candidates_count: number;
}

interface LiveCandidate {
  student_id: string;
  full_name: string;
  email: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PENDING_EVALUATION" | "EVALUATING" | "EVALUATED" | "FAILED";
  submission_id?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  elapsed_seconds?: number | null;
  total_strikes: number;
  strike_events: string[];
  total_score?: number | null;
  max_marks: number;
}

export default function TeacherDashboardPage() {
  const [activeTab, setActiveTab] = useState<"EXAMS" | "STUDENTS">("EXAMS");
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringBatch, setTriggeringBatch] = useState(false);
  const [evaluatingSingleId, setEvaluatingSingleId] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Live Candidate State (On-demand Refresh)
  const [liveRosterData, setLiveRosterData] = useState<{
    summary: LiveRosterSummary;
    roster: LiveCandidate[];
    exam: any;
  } | null>(null);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<"ALL" | "IN_PROGRESS" | "SUBMITTED" | "NOT_STARTED" | "FLAGGED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // Candidate Management State
  const [studentsList, setStudentsList] = useState<StudentCredential[]>([]);
  const [recentGeneratedCredentials, setRecentGeneratedCredentials] = useState<StudentCredential[]>([]);
  const [csvUploading, setCsvUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLiveRoster = useCallback(async (examId: string) => {
    try {
      const data = await apiRequest<any>(`/review/exam/${examId}/live-roster`);
      setLiveRosterData(data);
      setLastPollTime(new Date());
    } catch (err) {
      console.error("Error loading live roster", err);
    }
  }, []);

  const loadSubmissionsAndStatus = useCallback(async (examId: string, showRefreshingState = false) => {
    try {
      if (showRefreshingState) setRefreshing(true);
      const status = await apiRequest<BatchStatus>(`/review/exam/${examId}/evaluation-status`);
      setBatchStatus(status);
      await loadLiveRoster(examId);
    } catch (err) {
      console.error("Error loading exam review data", err);
    } finally {
      if (showRefreshingState) setRefreshing(false);
    }
  }, [loadLiveRoster]);

  const loadStudents = useCallback(async () => {
    try {
      const data = await apiRequest<StudentCredential[]>("/teacher/students/");
      setStudentsList(data);
    } catch (err) {
      console.error("Error loading students", err);
    }
  }, []);

  useEffect(() => {
    async function initData() {
      try {
        const examsData = await apiRequest<any[]>("/exams/");
        setExams(examsData);
        if (examsData.length > 0) {
          setSelectedExamId(examsData[0].id);
        }
        await loadStudents();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [loadStudents]);

  useEffect(() => {
    if (!selectedExamId) return;
    loadSubmissionsAndStatus(selectedExamId);

    // Only auto-poll if batch evaluation is actively in progress
    if (batchStatus?.is_evaluating || (batchStatus?.evaluating && batchStatus.evaluating > 0)) {
      const interval = setInterval(() => {
        loadSubmissionsAndStatus(selectedExamId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedExamId, batchStatus?.is_evaluating, batchStatus?.evaluating, loadSubmissionsAndStatus]);

  const handleStartBatchEvaluation = async () => {
    if (!selectedExamId || triggeringBatch) return;
    try {
      setTriggeringBatch(true);
      await apiRequest(`/review/exam/${selectedExamId}/start-evaluation`, {
        method: "POST",
      });
      await loadSubmissionsAndStatus(selectedExamId);
    } catch (err: any) {
      alert("Failed to start batch evaluation: " + err.message);
    } finally {
      setTriggeringBatch(false);
    }
  };

  const handleEvaluateSingle = async (submissionId: string) => {
    try {
      setEvaluatingSingleId(submissionId);
      await apiRequest(`/review/submission/${submissionId}/evaluate-now`, {
        method: "POST",
      });
      if (selectedExamId) {
        setTimeout(() => loadSubmissionsAndStatus(selectedExamId), 1000);
      }
    } catch (err: any) {
      alert("Failed to evaluate submission: " + err.message);
    } finally {
      setEvaluatingSingleId(null);
    }
  };

  const handleToggleExamStatus = async () => {
    if (!selectedExamId || togglingStatus) return;
    const currentExam = exams.find((e) => e.id === selectedExamId);
    const isCurrentlyActive = currentExam?.is_active !== false;

    const confirmMsg = isCurrentlyActive
      ? "Are you sure you want to end this assessment early? Once closed, students will be locked out and no further submissions will be accepted."
      : "Are you sure you want to reopen this assessment for students?";

    if (!window.confirm(confirmMsg)) return;

    try {
      setTogglingStatus(true);
      const updatedExam = await apiRequest<any>(`/exams/${selectedExamId}/toggle-status`, {
        method: "PATCH",
      });
      setExams((prev) =>
        prev.map((e) => (e.id === selectedExamId ? { ...e, is_active: updatedExam.is_active } : e))
      );
      await loadSubmissionsAndStatus(selectedExamId);
    } catch (err: any) {
      alert("Failed to toggle exam status: " + err.message);
    } finally {
      setTogglingStatus(false);
    }
  };

  const downloadExamDashboardCsv = async () => {
    if (!selectedExamId) return;
    try {
      setDownloadingCsv(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("exam_token") : "";
      const res = await fetch(`${API_URL}/review/exam/${selectedExamId}/export-csv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to download results CSV");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const examObj = exams.find((e) => e.id === selectedExamId);
      const code = examObj?.access_code || "EXAM";
      a.download = `exam_dashboard_${code}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert("Error downloading dashboard CSV: " + err.message);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setCsvUploading(true);
      const token = localStorage.getItem("exam_token");
      const res = await fetch(`${API_URL}/teacher/students/upload-csv`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || "Failed to upload CSV");
      }

      const createdList: StudentCredential[] = await res.json();
      setRecentGeneratedCredentials(createdList);
      await loadStudents();
      alert(`Successfully created ${createdList.length} candidate accounts! Download or copy the credentials below.`);
    } catch (err: any) {
      alert("CSV Upload Error: " + err.message);
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8,full_name,email,password\nAlice Johnson,alice@company.com,\nBob Smith,bob@company.com,CustomPass@123\nCharlie Brown,charlie@company.com,\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_students_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExportCsv = () => {
    const token = localStorage.getItem("exam_token");
    window.open(`${API_URL}/teacher/students/export-csv`, "_blank");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-gray-500 text-sm">
        Loading instructor portal...
      </div>
    );
  }

  const format24Time = (isoString?: string | null) => {
    if (!isoString) return "—";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Instructor Management Portal</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Administer examinations, import candidate accounts via CSV, and trigger lazy batch evaluations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/teacher/exam/new"
            className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded transition text-center"
          >
            + Create Assessment
          </Link>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-2 border-b border-gray-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("EXAMS")}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === "EXAMS"
              ? "border-gray-900 text-gray-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Assessments & Evaluation ({exams.length})
        </button>
        <button
          onClick={() => setActiveTab("STUDENTS")}
          className={`px-4 py-2.5 border-b-2 transition ${
            activeTab === "STUDENTS"
              ? "border-gray-900 text-gray-900 font-bold"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          Candidate Accounts & CSV ({studentsList.length})
        </button>
      </div>

      {/* TAB 1: EXAMS & EVALUATION */}
      {activeTab === "EXAMS" && (
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
                    <div className="flex items-center justify-between">
                      <h4 className="line-clamp-1 font-semibold">{ex.title}</h4>
                      <div className="flex items-center space-x-1">
                        {ex.is_active !== false ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                            Closed
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded">
                          {ex.access_code}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                      <span>{ex.questions?.length || 0} Questions</span>
                      <span>{ex.duration_minutes} min ({ex.timer_mode || "LOCAL"})</span>
                    </div>
                  </button>
                );
              })}

              {exams.length === 0 && (
                <div className="text-center py-6 text-gray-400 text-xs">
                  No assessments created yet.
                </div>
              )}
            </div>
          </div>

          {/* Right: Submissions Table & Batch Evaluation Controller */}
          <div className="lg:col-span-2 space-y-4">
            {selectedExam && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4 shadow-2xs">
                {/* Header Metadata */}
                <div className="border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Access Code:
                    </span>
                    <span className="text-xs font-mono font-bold bg-gray-900 text-white px-2 py-0.5 rounded">
                      {selectedExam.access_code}
                    </span>
                    {selectedExam.is_active !== false ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-300 px-2 py-0.5 rounded">
                        Closed
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">
                      • {selectedExam.duration_minutes} mins ({selectedExam.timer_mode || "LOCAL"} Timer)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mt-1">
                    {selectedExam.title}
                  </h3>
                </div>

                {/* On-Demand Telemetry Feed Indicator */}
                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3.5 py-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2">
                      {batchStatus?.is_evaluating && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${batchStatus?.is_evaluating ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                    </span>
                    <span className="font-semibold text-gray-800">
                      {batchStatus?.is_evaluating ? "AI Evaluation In Progress..." : "Manual Sync Mode"}
                    </span>
                    <span className="text-gray-400 text-[11px] font-mono">
                      (Last synced: {format24Time(lastPollTime.toISOString())})
                    </span>
                  </div>

                  <button
                    onClick={() => selectedExamId && loadSubmissionsAndStatus(selectedExamId, true)}
                    disabled={refreshing}
                    className="text-[11px] font-semibold text-gray-700 hover:text-gray-950 flex items-center space-x-1 px-2.5 py-1 bg-white border border-gray-200 rounded shadow-2xs hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    <span className={refreshing ? "animate-spin inline-block" : ""}>🔄</span>
                    <span>{refreshing ? "Refreshing..." : "Refresh Feed"}</span>
                  </button>
                </div>

                {/* 4 Interactive Live Summary Metric Cards */}
                {liveRosterData?.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                    {/* 1. Started / In-Progress Taking Exam */}
                    <button
                      onClick={() => setStatusFilter(statusFilter === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS")}
                      className={`p-2.5 rounded border transition text-left ${
                        statusFilter === "IN_PROGRESS"
                          ? "bg-emerald-50 border-emerald-600 ring-1 ring-emerald-600"
                          : "bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50 text-emerald-950"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block tracking-wider">
                          Started
                        </span>
                        {liveRosterData.summary.in_progress_count > 0 && (
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        )}
                      </div>
                      <span className="font-extrabold text-emerald-950 text-lg block mt-0.5">
                        {liveRosterData.summary.in_progress_count}
                      </span>
                      <span className="text-[10px] text-emerald-700">Currently taking exam</span>
                    </button>

                    {/* 2. Submitted / Evaluated */}
                    <button
                      onClick={() => setStatusFilter(statusFilter === "SUBMITTED" ? "ALL" : "SUBMITTED")}
                      className={`p-2.5 rounded border transition text-left ${
                        statusFilter === "SUBMITTED"
                          ? "bg-blue-50 border-blue-600 ring-1 ring-blue-600"
                          : "bg-blue-50/40 border-blue-200 hover:bg-blue-50 text-blue-950"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-blue-800 block tracking-wider">
                        Submitted
                      </span>
                      <span className="font-extrabold text-blue-950 text-lg block mt-0.5">
                        {liveRosterData.summary.submitted_count}
                      </span>
                      <span className="text-[10px] text-blue-700">Finished papers</span>
                    </button>

                    {/* 3. Nil (Not Started) */}
                    <button
                      onClick={() => setStatusFilter(statusFilter === "NOT_STARTED" ? "ALL" : "NOT_STARTED")}
                      className={`p-2.5 rounded border transition text-left ${
                        statusFilter === "NOT_STARTED"
                          ? "bg-gray-100 border-gray-600 ring-1 ring-gray-600"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100/60 text-gray-800"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-gray-600 block tracking-wider">
                        Nil
                      </span>
                      <span className="font-extrabold text-gray-900 text-lg block mt-0.5">
                        {liveRosterData.summary.not_started_count}
                      </span>
                      <span className="text-[10px] text-gray-500">Awaiting code entry</span>
                    </button>

                    {/* 4. Security Strikes */}
                    <button
                      onClick={() => setStatusFilter(statusFilter === "FLAGGED" ? "ALL" : "FLAGGED")}
                      className={`p-2.5 rounded border transition text-left ${
                        statusFilter === "FLAGGED"
                          ? "bg-red-50 border-red-600 ring-1 ring-red-600"
                          : "bg-red-50/40 border-red-200 hover:bg-red-50 text-red-950"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-red-800 block tracking-wider">
                        Security Flags
                      </span>
                      <span className="font-extrabold text-red-950 text-lg block mt-0.5">
                        {liveRosterData.summary.flagged_candidates_count}
                      </span>
                      <span className="text-[10px] text-red-700">
                        {liveRosterData.summary.total_strikes} Total Violations
                      </span>
                    </button>
                  </div>
                )}

                {/* Progress Bar for AI Batch Evaluation */}
                {batchStatus && batchStatus.total > 0 && (
                  <div className="space-y-1 bg-gray-50 p-2.5 rounded border border-gray-200">
                    <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                      <span>AI Batch Evaluation Progress</span>
                      <span className="font-mono">{batchStatus.evaluated}/{batchStatus.total} ({batchStatus.progress_percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gray-900 h-1.5 transition-all duration-500"
                        style={{ width: `${batchStatus.progress_percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Single Line Action Controls below Batch Progress */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                  {batchStatus && (
                    <button
                      onClick={handleStartBatchEvaluation}
                      disabled={triggeringBatch || batchStatus.pending === 0 || batchStatus.is_evaluating}
                      className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 whitespace-nowrap shadow-2xs"
                    >
                      <span>
                        {batchStatus.is_evaluating
                          ? "Evaluating Batch..."
                          : triggeringBatch
                          ? "Starting..."
                          : `Start AI Evaluation (${batchStatus.pending})`}
                      </span>
                    </button>
                  )}

                  <Link
                    href={`/teacher/exam/new?edit=${selectedExamId}`}
                    className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-800 bg-white rounded text-xs font-semibold transition flex items-center justify-center whitespace-nowrap shadow-2xs"
                    title="Edit assessment details, questions, and marks"
                  >
                    Edit Exam
                  </Link>

                  <button
                    onClick={() => selectedExamId && loadSubmissionsAndStatus(selectedExamId, true)}
                    disabled={refreshing}
                    className="px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 bg-white rounded text-xs font-semibold transition flex items-center justify-center whitespace-nowrap shadow-2xs disabled:opacity-50"
                    title="Refresh status now"
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            )}

            {/* Live Candidate Pooling & Roster Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden space-y-0 shadow-2xs">
              {/* Table Toolbar (Search & Status Filter Tabs) */}
              <div className="p-3.5 border-b border-gray-200 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Candidate Roster & Live Pooling
                  </span>
                  {liveRosterData?.roster && (
                    <span className="text-xs bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded font-semibold">
                      {liveRosterData.roster.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search box */}
                  <input
                    type="text"
                    placeholder="Search candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-900 w-40 sm:w-48"
                  />

                  {/* Filter select */}
                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-gray-900"
                  >
                    <option value="ALL">All Candidates</option>
                    <option value="IN_PROGRESS">Started</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="NOT_STARTED">Nil (Not Started)</option>
                    <option value="FLAGGED">Flagged (With Strikes)</option>
                  </select>
                </div>
              </div>

              {/* Roster Table Content */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold text-[11px]">
                      <th className="p-3.5">Candidate</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Submitted</th>
                      <th className="p-3.5">Security Strikes</th>
                      <th className="p-3.5">Score</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const allRoster = liveRosterData?.roster || [];
                      const filtered = allRoster.filter((cand) => {
                        if (statusFilter === "IN_PROGRESS" && cand.status !== "IN_PROGRESS") return false;
                        if (statusFilter === "SUBMITTED" && (cand.status === "NOT_STARTED" || cand.status === "IN_PROGRESS")) return false;
                        if (statusFilter === "NOT_STARTED" && cand.status !== "NOT_STARTED") return false;
                        if (statusFilter === "FLAGGED" && cand.total_strikes === 0) return false;

                        if (searchQuery.trim()) {
                           const q = searchQuery.toLowerCase();
                          const matchName = cand.full_name?.toLowerCase().includes(q);
                          const matchEmail = cand.email?.toLowerCase().includes(q);
                          return matchName || matchEmail;
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-gray-400 text-xs">
                              {searchQuery || statusFilter !== "ALL"
                                ? "No candidates match the selected filter."
                                : "No candidates registered for this exam yet."}
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((cand) => {
                        const isEvaluatingThis = Boolean(
                          cand.submission_id &&
                          (evaluatingSingleId === cand.submission_id || cand.status === "EVALUATING")
                        );

                        return (
                          <tr key={cand.student_id} className="hover:bg-gray-50/50 transition">
                            {/* Candidate Info (Name only, without subtitle email to free horizontal space) */}
                            <td className="p-3.5">
                              <span className="font-semibold text-gray-900 text-xs">{cand.full_name}</span>
                            </td>

                            {/* Status Badge */}
                            <td className="p-3.5">
                              {cand.status === "IN_PROGRESS" ? (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                  <span>Started</span>
                                </span>
                              ) : cand.status === "EVALUATED" ? (
                                <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Evaluated
                                </span>
                              ) : cand.status === "EVALUATING" ? (
                                <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 animate-pulse">
                                  Evaluating...
                                </span>
                              ) : cand.status === "PENDING_EVALUATION" ? (
                                <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  Submitted
                                </span>
                              ) : cand.status === "NOT_STARTED" ? (
                                <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                                  Nil
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-gray-50 text-gray-700 border border-gray-200">
                                  {cand.status}
                                </span>
                              )}
                            </td>

                            {/* Submitted Column (24-hour time format) */}
                            <td className="p-3.5 text-gray-600 text-xs font-mono">
                              {cand.status === "IN_PROGRESS" ? (
                                <span className="text-emerald-700 font-medium">
                                  {format24Time(cand.started_at)}
                                </span>
                              ) : cand.submitted_at ? (
                                <span>{format24Time(cand.submitted_at)}</span>
                              ) : (
                                <span className="text-gray-400 font-sans">—</span>
                              )}
                            </td>

                            {/* Security Strikes */}
                            <td className="p-3.5">
                              {cand.total_strikes > 0 ? (
                                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 font-semibold inline-block text-[11px]">
                                  {cand.total_strikes} Strikes
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">0 (Clean)</span>
                              )}
                            </td>

                            {/* Score */}
                            <td className="p-3.5 font-semibold text-gray-900 text-xs">
                              {cand.status === "EVALUATED" && cand.total_score !== null && cand.total_score !== undefined
                                ? `${cand.total_score}`
                                : cand.status === "IN_PROGRESS"
                                ? <span className="text-emerald-600 font-normal">Started</span>
                                : cand.status === "NOT_STARTED"
                                ? <span className="text-gray-400 font-normal">—</span>
                                : <span className="text-amber-600 font-normal">Pending</span>}
                            </td>

                            {/* Actions Column: side-by-side equal width buttons */}
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {cand.submission_id && cand.status !== "NOT_STARTED" && cand.status !== "IN_PROGRESS" ? (
                                  <>
                                    {cand.status !== "EVALUATED" && (
                                      <button
                                        onClick={() => handleEvaluateSingle(cand.submission_id!)}
                                        disabled={isEvaluatingThis}
                                        className="w-20 h-7 text-xs font-medium bg-gray-900 hover:bg-black text-white rounded transition flex items-center justify-center disabled:opacity-40"
                                      >
                                        {isEvaluatingThis ? "Grading..." : "Evaluate"}
                                      </button>
                                    )}
                                    <Link
                                      href={`/teacher/review/${cand.submission_id}`}
                                      className="w-20 h-7 text-xs font-medium bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded transition flex items-center justify-center"
                                    >
                                      Review
                                    </Link>
                                  </>
                                ) : cand.status === "IN_PROGRESS" ? (
                                  <span className="w-20 h-7 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-center">
                                    Started
                                  </span>
                                ) : (
                                  <span className="w-20 h-7 text-[11px] text-gray-400 flex items-center justify-center">
                                    Nil
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Table Footer with End Assessment & Download Dashboard CSV Buttons */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Total Candidates: <span className="font-semibold text-gray-900">{liveRosterData?.roster?.length || 0}</span>
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* End Assessment Early / Reopen Assessment Button */}
                  <button
                    onClick={handleToggleExamStatus}
                    disabled={togglingStatus}
                    className={`px-4 py-2 rounded text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center space-x-1 shadow-2xs ${
                      selectedExam?.is_active !== false
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    <span>
                      {togglingStatus
                        ? "Updating..."
                        : selectedExam?.is_active !== false
                        ? "End Assessment"
                        : "Reopen Assessment"}
                    </span>
                  </button>

                  {/* Download Dashboard CSV Button */}
                  <button
                    onClick={downloadExamDashboardCsv}
                    disabled={downloadingCsv}
                    className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded text-xs font-semibold transition flex items-center justify-center space-x-2 shadow-2xs disabled:opacity-50"
                    title="Download full candidate list, live attendances & results CSV before or after exam"
                  >
                    <span>Download Results CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATE ACCOUNTS & CSV TOOLS */}
      {activeTab === "STUDENTS" && (
        <div className="space-y-6">
          {/* CSV Tools Action Banner */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Bulk Candidate CSV Upload</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload a CSV file containing candidate names and emails. Passwords will be auto-generated securely if left blank.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadSampleCsv}
                  className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-xs font-medium transition"
                >
                  Download Sample CSV
                </button>

                <button
                  onClick={downloadExportCsv}
                  className="bg-gray-900 hover:bg-black text-white px-3.5 py-1.5 rounded text-xs font-medium transition"
                >
                  Export All Candidates CSV
                </button>
              </div>
            </div>

            {/* Upload Area */}
            <div className="flex items-center space-x-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={csvUploading}
                className="text-xs file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-black file:cursor-pointer cursor-pointer text-gray-600"
              />
              {csvUploading && <span className="text-xs text-gray-500 animate-pulse">Processing CSV accounts...</span>}
            </div>
          </div>

          {/* Recently Generated Credentials Table (from CSV) */}
          {recentGeneratedCredentials.length > 0 && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Newly Created Candidate Credentials ({recentGeneratedCredentials.length})
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Hand these login details to your candidates to enter the examination system.
                  </p>
                </div>
                <button
                  onClick={() => setRecentGeneratedCredentials([])}
                  className="text-xs text-emerald-800 hover:text-emerald-950 underline"
                >
                  Dismiss
                </button>
              </div>

              <div className="overflow-x-auto bg-white rounded border border-emerald-200 max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-emerald-50 text-emerald-900 font-semibold border-b border-emerald-100">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Email (Username)</th>
                      <th className="p-2.5">Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentGeneratedCredentials.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2.5 font-medium text-gray-900">{c.full_name}</td>
                        <td className="p-2.5 text-gray-600 font-mono">{c.email}</td>
                        <td className="p-2.5 text-gray-900 font-mono font-bold select-all">{c.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Registered Candidates Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                All Registered Candidates ({studentsList.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 uppercase tracking-wider font-semibold">
                    <th className="p-3.5">Full Name</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Registered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {studentsList.map((st) => (
                    <tr key={st.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-3.5 font-semibold text-gray-900">{st.full_name}</td>
                      <td className="p-3.5 text-gray-600 font-mono">{st.email}</td>
                      <td className="p-3.5">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-medium border border-gray-200">
                          STUDENT
                        </span>
                      </td>
                      <td className="p-3.5 text-gray-400">
                        {new Date(st.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {studentsList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-gray-400">
                        No student candidates registered yet. Upload a CSV above to create accounts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
