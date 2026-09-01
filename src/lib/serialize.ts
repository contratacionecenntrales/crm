import type { Contact, LabOrder, LabResult } from "../../prisma/generated/client";

export type OrderWithRelations = LabOrder & {
  contact: Contact;
  result: LabResult | null;
};

export type SerializedOrder = Omit<
  OrderWithRelations,
  "orderedAt" | "completedAt" | "createdAt" | "updatedAt" | "contact" | "result"
> & {
  orderedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: Omit<Contact, "dob" | "createdAt" | "updatedAt"> & {
    dob: string | null;
    createdAt: string;
    updatedAt: string;
  };
  result:
    | (Omit<LabResult, "reportedAt" | "createdAt" | "updatedAt"> & {
        reportedAt: string;
        createdAt: string;
        updatedAt: string;
      })
    | null;
};

export function serializeOrder(order: OrderWithRelations): SerializedOrder {
  return {
    ...order,
    orderedAt: order.orderedAt.toISOString(),
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    contact: {
      ...order.contact,
      dob: order.contact.dob ? order.contact.dob.toISOString() : null,
      createdAt: order.contact.createdAt.toISOString(),
      updatedAt: order.contact.updatedAt.toISOString(),
    },
    result: order.result
      ? {
          ...order.result,
          reportedAt: order.result.reportedAt.toISOString(),
          createdAt: order.result.createdAt.toISOString(),
          updatedAt: order.result.updatedAt.toISOString(),
        }
      : null,
  };
}
