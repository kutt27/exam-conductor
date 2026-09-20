import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
      <p className="text-sm text-gray-500 mb-6">The requested page could not be found.</p>
      <Link
        href="/"
        className="bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded hover:bg-black transition"
      >
        Return Home
      </Link>
    </div>
  );
}
