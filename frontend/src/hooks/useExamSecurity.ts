"use client";

import { useEffect, useRef } from "react";

export function useExamSecurity(
  onStrike: (reason: string) => void,
  isActive: boolean = true
) {
  const onStrikeRef = useRef(onStrike);
  useEffect(() => {
    onStrikeRef.current = onStrike;
  }, [onStrike]);

  useEffect(() => {
    if (!isActive) return;

    // 1. Tab / Window Visibility Change Detector
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onStrikeRef.current("Tab switched or browser window minimized");
      }
    };

    // 2. Window Blur (Focus Lost / DevTools / Alt-Tab)
    const handleWindowBlur = () => {
      onStrikeRef.current("Window lost focus (Alt-Tab or multi-window switch)");
    };

    // 3. Prevent Copy, Cut, Paste Clipboard Events
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      onStrikeRef.current("Copy attempted (Restricted in exam environment)");
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      onStrikeRef.current("Cut attempted (Restricted in exam environment)");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      onStrikeRef.current("Paste attempted (Restricted in exam environment)");
    };

    // 4. Prevent Right-Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onStrikeRef.current("Right-click context menu attempted");
    };

    // 5. Restrict Dangerous Key Combinations (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U, F12, DevTools)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // F12 or Ctrl+Shift+I / Ctrl+Shift+J (DevTools)
      if (
        e.key === "F12" ||
        (isCtrlOrCmd && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c"))
      ) {
        e.preventDefault();
        onStrikeRef.current("Developer tools shortcut attempted");
        return;
      }

      // Ctrl+U (View Source)
      if (isCtrlOrCmd && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        onStrikeRef.current("View source shortcut attempted");
        return;
      }

      // Ctrl+C, Ctrl+V, Ctrl+X
      if (isCtrlOrCmd && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        onStrikeRef.current("Copy shortcut attempted (Ctrl+C)");
        return;
      }

      if (isCtrlOrCmd && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        onStrikeRef.current("Paste shortcut attempted (Ctrl+V)");
        return;
      }

      if (isCtrlOrCmd && (e.key === "x" || e.key === "X")) {
        e.preventDefault();
        onStrikeRef.current("Cut shortcut attempted (Ctrl+X)");
        return;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive]);
}
