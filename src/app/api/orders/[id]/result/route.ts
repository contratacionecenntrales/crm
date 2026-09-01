import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isResultFlag } from "@/lib/orders";

export async function POST(
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

  const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
  const flag = typeof payload.flag === "string" ? payload.flag : "NORMAL";
  const reportedBy =
    typeof payload.reportedBy === "string" ? payload.reportedBy.trim() : undefined;

  if (!summary) {
    return NextResponse.json({ error: "Summary is required" }, { status: 400 });
  }
  if (!isResultFlag(flag)) {
    return NextResponse.json({ error: "Invalid result flag" }, { status: 400 });
  }

  const order = await prisma.labOrder.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const result = await prisma.labResult.upsert({
    where: { labOrderId: id },
    update: { summary, flag, reportedBy },
    create: { labOrderId: id, summary, flag, reportedBy },
  });

  await prisma.labOrder.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return NextResponse.json({ result });
}
