"use client";

import { useEffect, useRef } from "react";

export interface CheatEvent {
  reason: string;
  timestamp: string;
}

export function useExamSecurity(
  onStrike: (reason: string) => void,
  enabled: boolean = true
) {
  const strikeCallbackRef = useRef(onStrike);
  strikeCallbackRef.current = onStrike;

  useEffect(() => {
    if (!enabled) return;

    // 1. Disable Clipboard & Context Menu
    const blockClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
    };
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("copy", blockClipboard);
    document.addEventListener("paste", blockClipboard);
    document.addEventListener("cut", blockClipboard);
    document.addEventListener("contextmenu", blockContextMenu);

    // 2. Tab-Switch / Window Visibility Detection
    const handleVisibility = () => {
      if (document.hidden) {
        strikeCallbackRef.current("Tab switch or minimized window detected");
      }
    };

    // 3. Fullscreen Exit Detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        strikeCallbackRef.current("Exited fullscreen examination mode");
      }
    };

    // 4. Window Blur Detection
    const handleBlur = () => {
      strikeCallbackRef.current("Window lost focus");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("copy", blockClipboard);
      document.removeEventListener("paste", blockClipboard);
      document.removeEventListener("cut", blockClipboard);
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled]);
}
