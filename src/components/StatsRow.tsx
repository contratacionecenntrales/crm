type Stats = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  critical: number;
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone ?? "text-gray-900"}`}>{value}</p>
    </div>
  );
}

export function StatsRow({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Total orders" value={stats.total} />
      <Stat label="Pending" value={stats.pending} tone="text-amber-600" />
      <Stat label="In progress" value={stats.inProgress} tone="text-blue-600" />
      <Stat label="Completed" value={stats.completed} tone="text-emerald-600" />
      <Stat label="Cancelled" value={stats.cancelled} tone="text-gray-500" />
      <Stat label="Critical results" value={stats.critical} tone="text-red-600" />
    </div>
  );
}
