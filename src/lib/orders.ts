import { OrderPriority, OrderStatus, ResultFlag } from "../../prisma/generated/enums";

export const ORDER_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[];

export const ORDER_PRIORITIES = [
  "ROUTINE",
  "URGENT",
  "STAT",
] as const satisfies readonly OrderPriority[];

export const RESULT_FLAGS = [
  "NORMAL",
  "ABNORMAL",
  "CRITICAL",
] as const satisfies readonly ResultFlag[];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isResultFlag(value: string): value is ResultFlag {
  return (RESULT_FLAGS as readonly string[]).includes(value);
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABELS: Record<OrderPriority, string> = {
  ROUTINE: "Routine",
  URGENT: "Urgent",
  STAT: "STAT",
};

export const FLAG_LABELS: Record<ResultFlag, string> = {
  NORMAL: "Normal",
  ABNORMAL: "Abnormal",
  CRITICAL: "Critical",
};
