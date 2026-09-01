import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serialize";
import { PriorityBadge, StatusBadge, FlagBadge } from "@/components/Badges";
import { OrderActions } from "@/components/OrderActions";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function LabOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: { contact: true, result: true },
  });

  if (!order) {
    notFound();
  }

  const serialized = serializeOrder(order);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/labs" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Command Center
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            {serialized.orderNumber} &middot; {serialized.testName}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {serialized.contact.firstName} {serialized.contact.lastName}
            {serialized.contact.email ? ` · ${serialized.contact.email}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <PriorityBadge priority={serialized.priority} />
          <StatusBadge status={serialized.status} />
        </div>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Ordered</dt>
          <dd className="mt-0.5 text-gray-900">{formatDateTime(serialized.orderedAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Completed</dt>
          <dd className="mt-0.5 text-gray-900">{formatDateTime(serialized.completedAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Phone</dt>
          <dd className="mt-0.5 text-gray-900">{serialized.contact.phone ?? "—"}</dd>
        </div>
      </dl>

      {serialized.notes && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p className="text-gray-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-gray-900">{serialized.notes}</p>
        </div>
      )}

      {serialized.result && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">Result</p>
            <FlagBadge flag={serialized.result.flag} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-gray-700">{serialized.result.summary}</p>
          <p className="mt-2 text-xs text-gray-400">
            Reported {formatDateTime(serialized.result.reportedAt)}
            {serialized.result.reportedBy ? ` by ${serialized.result.reportedBy}` : ""}
          </p>
        </div>
      )}

      <div className="mt-6">
        <OrderActions order={serialized} />
      </div>
    </main>
  );
}
