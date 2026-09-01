import { FLAG_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/orders";
import type { OrderPriority, OrderStatus, ResultFlag } from "../../prisma/generated/enums";

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-600/20",
  IN_PROGRESS: "bg-blue-100 text-blue-800 ring-blue-600/20",
  COMPLETED: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  CANCELLED: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

const PRIORITY_STYLES: Record<OrderPriority, string> = {
  ROUTINE: "bg-gray-100 text-gray-700 ring-gray-500/20",
  URGENT: "bg-orange-100 text-orange-800 ring-orange-600/20",
  STAT: "bg-red-100 text-red-800 ring-red-600/20",
};

const FLAG_STYLES: Record<ResultFlag, string> = {
  NORMAL: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  ABNORMAL: "bg-amber-100 text-amber-800 ring-amber-600/20",
  CRITICAL: "bg-red-100 text-red-800 ring-red-600/20",
};

function Badge({ className, children }: { className: string; children: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return <Badge className={PRIORITY_STYLES[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function FlagBadge({ flag }: { flag: ResultFlag }) {
  return <Badge className={FLAG_STYLES[flag]}>{FLAG_LABELS[flag]}</Badge>;
}
