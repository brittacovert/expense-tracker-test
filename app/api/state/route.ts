import { env } from "cloudflare:workers";
import { authenticatedUserId } from "./identity";

const demoState = {
  weekStartsOn: 1,
  selectedWeek: "2026-08-03",
  cash: 1800,
  income: 950,
  bills: [
    { id: "demo-rent", biller: "Studio rent", amount: 720, due: "2026-08-05", frequency: "Monthly", installments: 1 },
    { id: "demo-power", biller: "Electric service", amount: 86, due: "2026-08-07", frequency: "Monthly", installments: 1 },
    { id: "demo-license", biller: "Business license", amount: 240, due: "2026-09-30", frequency: "Yearly", allocationStart: "2026-08-03", installments: 8 },
  ],
  purchases: [
    { id: "demo-supplies", what: "Packing supplies", amount: 42.5, date: "2026-08-04", installments: 1 },
    { id: "demo-stock", what: "Seasonal inventory", amount: 600, date: "2026-08-28", allocationStart: "2026-08-03", installments: 4 },
  ],
  goals: [
    { id: "demo-debt", name: "Equipment balance", current: 1250, target: 3000, updated: "2026-08-01", kind: "debt" },
    { id: "demo-reserve", name: "Tax reserve", current: 900, target: 2500, updated: "2026-08-01", kind: "saving" },
  ],
};

async function ensureTable() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS planner_state (
    user_id TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

const unauthorized = () => Response.json({ error: "Sign in is required." }, { status: 401 });

export async function GET(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return unauthorized();
  await ensureTable();
  const row = await env.DB.prepare("SELECT value FROM planner_state WHERE user_id = ?")
    .bind(userId).first<{ value: string }>();
  return Response.json({ state: row ? JSON.parse(row.value) : demoState });
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return unauthorized();
  const body = await request.json() as { state?: unknown };
  if (!body.state) return Response.json({ error: "state is required" }, { status: 400 });
  await ensureTable();
  await env.DB.prepare(`INSERT INTO planner_state (user_id, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(userId, JSON.stringify(body.state), new Date().toISOString()).run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await authenticatedUserId(request);
  if (!userId) return unauthorized();
  await ensureTable();
  await env.DB.prepare("DELETE FROM planner_state WHERE user_id = ?").bind(userId).run();
  return Response.json({ state: demoState });
}
