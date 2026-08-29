"use client";

import React, { useRef } from "react";

interface CodeDocEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxMarks?: number;
  disabled?: boolean;
}

export function CodeDocEditor({
  value,
  onChange,
  placeholder = "// Write your solution logic, pseudocode/code outline, and explanation here...",
  maxMarks = 10,
  disabled = false,
}: CodeDocEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 2 spaces for standard tab
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);

      // Restore cursor position after update
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const lines = value.split("\n");
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50/50">
      {/* Google Docs Style Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 text-xs text-gray-600">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-gray-800">Response Document</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">Plain-text Logic & Code</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-400">Tab indent enabled</span>
        </div>
        <div className="flex items-center space-x-3 text-gray-500">
          <span>{lines.length} lines</span>
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
          <span className="font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
            {maxMarks} Marks
          </span>
        </div>
      </div>

      {/* Google Docs Canvas (Light Gray Background with White Paper Sheet) */}
      <div className="p-4 sm:p-6 bg-[#f8f9fa] flex justify-center">
        <div className="w-full max-w-3xl bg-white rounded border border-[#dadce0] shadow-[0_1px_3px_0_rgba(60,64,67,0.15)] flex min-h-[440px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
          {/* Subtle Line Numbering column */}
          <div className="hidden sm:block select-none py-6 pl-3 pr-2 text-right text-[11px] font-mono text-gray-300 border-r border-gray-100 bg-[#fafafa] w-10">
            {Array.from({ length: Math.max(lines.length, 14) }).map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Clean White Document Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            rows={16}
            className="w-full font-mono text-[13.5px] leading-6 p-6 bg-white text-gray-900 focus:outline-none resize-y border-none placeholder:text-gray-400 placeholder:font-sans"
            placeholder={placeholder}
          />
        </div>
      </div>
    </div>
  );
}
