import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/testDb";

test.beforeEach(() => resetDb());

async function findOrderId(request: import("@playwright/test").APIRequestContext, orderNumber: string) {
  const res = await request.get(`/api/orders?q=${encodeURIComponent(orderNumber)}`);
  const body = await res.json();
  const order = body.orders.find((o: { orderNumber: string }) => o.orderNumber === orderNumber);
  if (!order) throw new Error(`Fixture order ${orderNumber} not found`);
  return order.id as string;
}

test.describe("GET /api/orders", () => {
  test("returns all seeded orders with no filters", async ({ request }) => {
    const res = await request.get("/api/orders");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(4);
  });

  test("filters by status", async ({ request }) => {
    const res = await request.get("/api/orders?status=COMPLETED");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].orderNumber).toBe("LO-E2E-003");
  });

  test("rejects an invalid status filter", async ({ request }) => {
    const res = await request.get("/api/orders?status=NOT_REAL");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  test("searches by full patient name across first and last name", async ({ request }) => {
    const res = await request.get("/api/orders?q=" + encodeURIComponent("Ana Torres"));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(2);
    for (const order of body.orders) {
      expect(order.contact.firstName).toBe("Ana");
      expect(order.contact.lastName).toBe("Torres");
    }
  });

  test("search is case-insensitive and matches partial words", async ({ request }) => {
    const res = await request.get("/api/orders?q=thyr");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].orderNumber).toBe("LO-E2E-003");
  });

  test("returns an empty list when nothing matches", async ({ request }) => {
    const res = await request.get("/api/orders?q=nonexistent-xyz");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(0);
  });
});

test.describe("PATCH /api/orders/[id]", () => {
  test("updates status and sets completedAt on completion", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.patch(`/api/orders/${id}`, { data: { status: "COMPLETED" } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.order.status).toBe("COMPLETED");
    expect(body.order.completedAt).not.toBeNull();
  });

  test("clears completedAt when moved off completed", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-003"); // seeded COMPLETED
    const res = await request.patch(`/api/orders/${id}`, { data: { status: "IN_PROGRESS" } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.order.status).toBe("IN_PROGRESS");
    expect(body.order.completedAt).toBeNull();
  });

  test("rejects an invalid status value", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.patch(`/api/orders/${id}`, { data: { status: "NOT_A_STATUS" } });
    expect(res.status()).toBe(400);
  });

  test("rejects a non-string notes field", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.patch(`/api/orders/${id}`, { data: { notes: 12345 } });
    expect(res.status()).toBe(400);
  });

  test("rejects an empty update body", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.patch(`/api/orders/${id}`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test("rejects malformed JSON", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.patch(`/api/orders/${id}`, {
      data: "{not valid json",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 for an unknown order id", async ({ request }) => {
    const res = await request.patch("/api/orders/does-not-exist", {
      data: { status: "COMPLETED" },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("POST /api/orders/[id]/result", () => {
  test("creates a result and marks the order completed", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-002"); // seeded IN_PROGRESS
    const res = await request.post(`/api/orders/${id}/result`, {
      data: { summary: "Looks fine.", flag: "NORMAL", reportedBy: "Dr. API Test" },
    });
    expect(res.status()).toBe(200);

    const order = await (await request.get(`/api/orders/${id}`)).json();
    expect(order.order.status).toBe("COMPLETED");
    expect(order.order.result.summary).toBe("Looks fine.");
  });

  test("upserts (updates) an existing result rather than duplicating", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-003"); // seeded with a result already
    const res = await request.post(`/api/orders/${id}/result`, {
      data: { summary: "Updated summary.", flag: "ABNORMAL" },
    });
    expect(res.status()).toBe(200);

    const order = await (await request.get(`/api/orders/${id}`)).json();
    expect(order.order.result.summary).toBe("Updated summary.");
    expect(order.order.result.flag).toBe("ABNORMAL");
  });

  test("rejects an empty summary", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.post(`/api/orders/${id}/result`, {
      data: { summary: "   ", flag: "NORMAL" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects an invalid flag", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.post(`/api/orders/${id}/result`, {
      data: { summary: "Fine.", flag: "NOT_A_FLAG" },
    });
    expect(res.status()).toBe(400);
  });

  test("returns 404 for an unknown order id", async ({ request }) => {
    const res = await request.post("/api/orders/does-not-exist/result", {
      data: { summary: "Fine.", flag: "NORMAL" },
    });
    expect(res.status()).toBe(404);
  });

  test("rejects malformed JSON", async ({ request }) => {
    const id = await findOrderId(request, "LO-E2E-001");
    const res = await request.post(`/api/orders/${id}/result`, {
      data: "not json at all",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });
});
