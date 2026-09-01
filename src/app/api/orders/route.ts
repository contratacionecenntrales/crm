import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOrderStatus } from "@/lib/orders";
import type { Prisma } from "../../../../prisma/generated/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const where: Prisma.LabOrderWhereInput = {};

  if (status && status !== "ALL") {
    if (!isOrderStatus(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    where.status = status;
  }

  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    where.AND = words.map((word) => ({
      OR: [
        { orderNumber: { contains: word, mode: "insensitive" } },
        { testName: { contains: word, mode: "insensitive" } },
        { contact: { firstName: { contains: word, mode: "insensitive" } } },
        { contact: { lastName: { contains: word, mode: "insensitive" } } },
      ],
    }));
  }

  const orders = await prisma.labOrder.findMany({
    where,
    include: { contact: true, result: true },
    orderBy: { orderedAt: "desc" },
  });

  return NextResponse.json({ orders });
}
