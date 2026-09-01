"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ORDER_STATUSES, RESULT_FLAGS, STATUS_LABELS, FLAG_LABELS } from "@/lib/orders";
import type { SerializedOrder } from "@/lib/serialize";

export function OrderActions({ order }: { order: SerializedOrder }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState(order.result?.summary ?? "");
  const [flag, setFlag] = useState(order.result?.flag ?? "NORMAL");
  const [reportedBy, setReportedBy] = useState(order.result?.reportedBy ?? "");

  async function updateStatus(status: string) {
    setError(null);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update status");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!summary.trim()) {
      setError("Result summary is required");
      return;
    }
    const res = await fetch(`/api/orders/${order.id}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, flag, reportedBy }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save result");
      return;
    }
    startTransition(() => router.refresh());
  }

  const canRecordResult = order.status !== "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium text-gray-900">Update status</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {ORDER_STATUSES.map((status) => (
            <button
              key={status}
              disabled={isPending || status === order.status}
              onClick={() => updateStatus(status)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed ${
                status === order.status
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {canRecordResult && (
        <form
          onSubmit={submitResult}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-medium text-gray-900">
            {order.result ? "Update result" : "Record result"}
          </h2>

          <label
            htmlFor="result-summary"
            className="mt-3 block text-xs font-medium text-gray-500"
          >
            Summary
          </label>
          <textarea
            id="result-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none"
            placeholder="Findings summary..."
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="result-flag" className="block text-xs font-medium text-gray-500">
                Flag
              </label>
              <select
                id="result-flag"
                value={flag}
                onChange={(e) => setFlag(e.target.value as typeof flag)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none"
              >
                {RESULT_FLAGS.map((f) => (
                  <option key={f} value={f}>
                    {FLAG_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="result-reported-by"
                className="block text-xs font-medium text-gray-500"
              >
                Reported by
              </label>
              <input
                id="result-reported-by"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none"
                placeholder="Dr. Jane Doe"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-4 rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Save result &amp; mark completed
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
