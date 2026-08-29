"use client";

import React from "react";

interface McqCardProps {
  options: string[];
  selectedOption: string;
  onChange: (opt: string) => void;
  disabled?: boolean;
}

export function McqCard({
  options,
  selectedOption,
  onChange,
  disabled = false,
}: McqCardProps) {
  return (
    <div className="space-y-2.5">
      {options.map((opt, idx) => {
        const isSelected = selectedOption === opt || selectedOption === opt.substring(0, 1);

        return (
          <label
            key={idx}
            className={`w-full flex items-center p-3.5 rounded-lg border transition text-sm ${
              isSelected
                ? "border-blue-600 bg-blue-50/40 text-gray-900 font-medium ring-1 ring-blue-600"
                : "border-gray-200 bg-white hover:bg-gray-50 text-gray-800"
            } ${disabled ? "opacity-75 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name="mcq-option"
              checked={isSelected}
              onChange={() => onChange(opt)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mr-3"
            />
            <span className="leading-snug">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}
