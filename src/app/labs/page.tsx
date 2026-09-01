import { prisma } from "@/lib/prisma";
import { serializeOrder } from "@/lib/serialize";
import { OrdersExplorer } from "@/components/OrdersExplorer";
import { StatsRow } from "@/components/StatsRow";

export const dynamic = "force-dynamic";

export default async function LabsCommandCenterPage() {
  const orders = await prisma.labOrder.findMany({
    include: { contact: true, result: true },
    orderBy: { orderedAt: "desc" },
  });

  const serialized = orders.map(serializeOrder);

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    inProgress: orders.filter((o) => o.status === "IN_PROGRESS").length,
    completed: orders.filter((o) => o.status === "COMPLETED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    critical: orders.filter((o) => o.result?.flag === "CRITICAL").length,
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Labs Command Center 360
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track every lab test order across your contacts, from order to result.
        </p>
      </header>

      <StatsRow stats={stats} />

      <div className="mt-8">
        <OrdersExplorer initialOrders={serialized} />
      </div>
    </main>
  );
}
