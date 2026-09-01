"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/orders";
import type { SerializedOrder } from "@/lib/serialize";
import { PriorityBadge, StatusBadge } from "@/components/Badges";

const STATUS_FILTERS = ["ALL", ...ORDER_STATUSES] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function OrdersExplorer({ initialOrders }: { initialOrders: SerializedOrder[] }) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialOrders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        order.orderNumber,
        order.testName,
        order.contact.firstName,
        order.contact.lastName,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [initialOrders, statusFilter, query]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                statusFilter === status
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status === "ALL" ? "All" : STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search order #, test, or patient..."
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none sm:w-72"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Order #</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Patient</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Test</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Priority</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-gray-500">Ordered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/labs/${order.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-900">
                  {order.contact.firstName} {order.contact.lastName}
                </td>
                <td className="px-4 py-2.5 text-gray-700">{order.testName}</td>
                <td className="px-4 py-2.5">
                  <PriorityBadge priority={order.priority} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-2.5 text-gray-500">{formatDate(order.orderedAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  No lab orders match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
