"use client";

import { useEffect, useState } from "react";

interface ExamTimerProps {
  durationMinutes: number;
  onTimeUp: () => void;
  storageKey?: string;
  timerMode?: "LOCAL" | "GLOBAL";
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
}

export function ExamTimer({
  durationMinutes,
  onTimeUp,
  storageKey,
  timerMode = "LOCAL",
  scheduledStartTime,
  scheduledEndTime,
}: ExamTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(durationMinutes * 60);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    if (timerMode === "GLOBAL") {
      const now = Date.now();
      if (scheduledEndTime) {
        const endTime = new Date(scheduledEndTime).getTime();
        setSecondsRemaining(Math.max(0, Math.floor((endTime - now) / 1000)));
      } else if (scheduledStartTime) {
        const startTime = new Date(scheduledStartTime).getTime();
        const endTime = startTime + durationMinutes * 60 * 1000;
        setSecondsRemaining(Math.max(0, Math.floor((endTime - now) / 1000)));
      }
    } else if (storageKey && typeof window !== "undefined") {
      const savedStart = localStorage.getItem(`${storageKey}_start_time`);
      if (savedStart) {
        const startTime = parseInt(savedStart, 10);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const left = durationMinutes * 60 - elapsed;
        setSecondsRemaining(Math.max(0, left));
      } else {
        localStorage.setItem(`${storageKey}_start_time`, String(Date.now()));
      }
    }
  }, [durationMinutes, scheduledEndTime, scheduledStartTime, storageKey, timerMode]);

  useEffect(() => {
    if (!hasMounted) return;
    if (secondsRemaining <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, onTimeUp, hasMounted]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const isUrgent = secondsRemaining < 300; // under 5 minutes

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`px-3 py-1 rounded border text-xs font-mono font-medium flex items-center space-x-1.5 ${
          isUrgent
            ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
            : "bg-gray-50 text-gray-700 border-gray-200"
        }`}
      >
        <span className="text-[10px] text-gray-400 font-sans uppercase font-semibold">
          {timerMode === "GLOBAL" ? "Global Clock:" : "Local Clock:"}
        </span>
        <span className="font-bold">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
