import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isResultFlag } from "@/lib/orders";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const flag = typeof body.flag === "string" ? body.flag : "NORMAL";
  const reportedBy = typeof body.reportedBy === "string" ? body.reportedBy.trim() : undefined;

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
