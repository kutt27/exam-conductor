"use client";

interface SecurityWarningModalProps {
  isOpen: boolean;
  strikeCount: number;
  lastReason: string;
  onDismiss: () => void;
}

export function SecurityWarningModal({
  isOpen,
  strikeCount,
  lastReason,
  onDismiss,
}: SecurityWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Security Event Detected
          </h3>
          <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded">
            Strike #{strikeCount}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <strong className="text-gray-900 font-medium">Event:</strong> {lastReason}
        </p>

        <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200 mb-5 leading-relaxed">
          Please remain focused on this window. Tab switches, window minimization, and fullscreen exits are logged in the submission audit trail.
        </p>

        <button
          onClick={onDismiss}
          className="w-full bg-gray-900 hover:bg-black text-white text-sm font-medium py-2 px-4 rounded transition"
        >
          Acknowledge and Resume
        </button>
      </div>
    </div>
  );
}
