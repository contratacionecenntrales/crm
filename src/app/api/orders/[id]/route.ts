import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOrderStatus } from "@/lib/orders";
import { Prisma } from "../../../../../prisma/generated/client";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;

  const data: Prisma.LabOrderUpdateInput = {};

  if ("status" in payload) {
    if (typeof payload.status !== "string" || !isOrderStatus(payload.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = payload.status;
    data.completedAt = payload.status === "COMPLETED" ? new Date() : null;
  }

  if ("notes" in payload) {
    if (typeof payload.notes !== "string") {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    }
    data.notes = payload.notes;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  try {
    const order = await prisma.labOrder.update({
      where: { id },
      data,
      include: { contact: true, result: true },
    });
    return NextResponse.json({ order });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    throw error;
  }
}
