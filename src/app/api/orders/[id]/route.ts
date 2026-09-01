import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOrderStatus } from "@/lib/orders";
import type { Prisma } from "../../../../../prisma/generated/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.labOrder.findUnique({
    where: { id },
    include: { contact: true, result: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const data: Prisma.LabOrderUpdateInput = {};

  if (typeof body.status === "string") {
    if (!isOrderStatus(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.completedAt = body.status === "COMPLETED" ? new Date() : null;
  }

  if (typeof body.notes === "string") {
    data.notes = body.notes;
  }

  try {
    const order = await prisma.labOrder.update({
      where: { id },
      data,
      include: { contact: true, result: true },
    });
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
