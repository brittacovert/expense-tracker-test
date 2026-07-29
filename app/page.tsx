"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Bill = {
  id: string; biller: string; amount: number; due: string; frequency: string;
  allocationStart?: string; installments: number; occurrence?: boolean;
};
type Purchase = { id: string; what: string; amount: number; date: string; allocationStart?: string; installments: number };
type Goal = { id: string; name: string; current: number; target: number; updated: string; kind: "debt" | "saving" };
type AppState = {
  weekStartsOn: number; selectedWeek: string; cash: number; income: number;
  bills: Bill[]; purchases: Purchase[]; goals: Goal[];
};

const today = new Date("2026-08-03T12:00:00");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return iso(d);
};
const startOfWeek = (date: string, starts: number) => {
  const d = new Date(`${date}T12:00:00`);
  const delta = (d.getDay() - starts + 7) % 7;
  d.setDate(d.getDate() - delta); return iso(d);
};
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const pretty = (date: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", opts);
const uid = () => Math.random().toString(36).slice(2, 9);

const seed: AppState = {
  weekStartsOn: 1,
  selectedWeek: "2026-08-03",
  cash: 1800,
  income: 950,
  bills: [
    { id: "b1", biller: "Studio rent", amount: 720, due: "2026-08-05", frequency: "Monthly", installments: 1 },
    { id: "b2", biller: "Electric service", amount: 86, due: "2026-08-07", frequency: "Monthly", installments: 1 },
    { id: "b3", biller: "Business license", amount: 240, due: "2026-09-30", frequency: "Yearly", allocationStart: "2026-08-03", installments: 8 },
  ],
  purchases: [
    { id: "p1", what: "Packing supplies", amount: 42.5, date: "2026-08-04", installments: 1 },
    { id: "p2", what: "Seasonal inventory", amount: 600, date: "2026-08-28", allocationStart: "2026-08-03", installments: 4 },
  ],
  goals: [
    { id: "g1", name: "Equipment balance", current: 1250, target: 3000, updated: "2026-08-01", kind: "debt" },
    { id: "g2", name: "Tax reserve", current: 900, target: 2500, updated: "2026-08-01", kind: "saving" },
  ],
};

const recurrenceDays: Record<string, number> = { Weekly: 7, Monthly: 30, Quarterly: 91, Biannual: 182, Yearly: 365 };

export default function Home() {
  const [data, setData] = useState<AppState>(seed);
  const [tab, setTab] = useState<"plan" | "goals">("plan");
  const [modal, setModal] = useState<"bill" | "purchase" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    fetch("/api/state").then(r => {
      if (r.status === 401) setAuthRequired(true);
      return r.ok ? r.json() : Promise.reject();
    }).then(v => v.state && setData(v.state)).catch(() => {}).finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (!loaded || authRequired) return;
    const t = setTimeout(() => fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: data }) }).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [data, loaded, authRequired]);

  async function resetDemo() {
    if (!confirm("Reset your tester workspace to the fictional demo data? Your entries will be removed.")) return;
    const response = await fetch("/api/state", { method: "DELETE" });
    if (response.ok) {
      const value = await response.json();
      setData(value.state);
    }
  }

  const week = startOfWeek(data.selectedWeek, data.weekStartsOn);
  const weekEnd = addDays(week, 6);
  const inWeek = (date: string) => date >= week && date <= weekEnd;
  const directBills = data.bills.filter(b => inWeek(b.due) && !b.allocationStart).reduce((s, b) => s + b.amount, 0);
  const directPurchases = data.purchases.filter(p => inWeek(p.date) && !p.allocationStart).reduce((s, p) => s + p.amount, 0);
  const allocations = [...data.bills, ...data.purchases].filter(x => {
    if (!x.allocationStart) return false;
    const n = Math.max(1, x.installments);
    const end = addDays(startOfWeek(x.allocationStart, data.weekStartsOn), (n - 1) * 7);
    return week >= startOfWeek(x.allocationStart, data.weekStartsOn) && week <= end;
  }).reduce((s, x) => s + x.amount / Math.max(1, x.installments), 0);
  const available = data.cash + data.income - directBills - directPurchases - allocations;
  const upcoming = useMemo(() => data.bills.filter(b => b.due >= week).sort((a,b) => a.due.localeCompare(b.due)).slice(0, 7), [data.bills, week]);

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) => setData(d => ({ ...d, [key]: value }));
  const moveWeek = (n: number) => update("selectedWeek", addDays(week, n * 7));

  function addBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const base: Bill = {
      id: uid(), biller: String(f.get("biller")), amount: Number(f.get("amount")),
      due: String(f.get("due")), frequency: String(f.get("frequency")),
      allocationStart: f.get("allocate") ? String(f.get("allocationStart")) : undefined,
      installments: f.get("allocate") ? Number(f.get("installments")) || 1 : 1,
    };
    const bills = [base];
    const days = recurrenceDays[base.frequency];
    if (days) for (let i = 1; i <= 5; i++) bills.push({ ...base, id: uid(), due: addDays(base.due, days * i), occurrence: true, allocationStart: undefined });
    setData(d => ({ ...d, bills: [...d.bills, ...bills] }));
    setModal(null);
  }

  function addPurchase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p: Purchase = {
      id: uid(), what: String(f.get("what")), amount: Number(f.get("amount")), date: String(f.get("date")),
      allocationStart: f.get("allocate") ? String(f.get("allocationStart")) : undefined,
      installments: f.get("allocate") ? Number(f.get("installments")) || 1 : 1,
    };
    setData(d => ({ ...d, purchases: [...d.purchases, p] }));
    setModal(null);
  }

  return (
    <main>
      <header>
        <a className="brand" href="#"><span>◎</span> BOW</a>
        <nav aria-label="Main navigation">
          <button className={tab === "plan" ? "active" : ""} onClick={() => setTab("plan")}>Weekly plan</button>
          <button className={tab === "goals" ? "active" : ""} onClick={() => setTab("goals")}>Debts & goals</button>
        </nav>
        <button className="avatar" aria-label="Account menu">B</button>
      </header>

      {authRequired && <div className="auth-notice"><b>Tester sign-in required</b><span>This edition keeps every tester’s planner in a separate private workspace. Configure ChatGPT Sites access or Cloudflare Access before sharing it.</span></div>}

      {tab === "plan" ? (
        <>
          <section className="intro">
            <div><p className="eyebrow">WEEKLY CASH PLAN</p><h1>Know what’s safe to spend.</h1><p>Map bills, purchases, and future needs to the week they actually affect.</p></div>
            <div className="week-picker">
              <button onClick={() => moveWeek(-1)} aria-label="Previous week">←</button>
              <label><span>Viewing week</span><input type="date" value={week} onChange={e => update("selectedWeek", e.target.value)} /></label>
              <button onClick={() => moveWeek(1)} aria-label="Next week">→</button>
            </div>
          </section>
          <div className="demo-tools"><span>Using fictional tester data</span><button onClick={resetDemo} disabled={authRequired}>Reset demo data</button></div>

          <section className="balance-hero">
            <div><p>AVAILABLE TO SPEND</p><strong className={available < 0 ? "negative" : ""}>{money(available)}</strong><span>{pretty(week)} – {pretty(weekEnd, { month: "short", day: "numeric", year: "numeric" })}</span></div>
            <div className="equation">
              <EditableMoney label="Cash at BOW" value={data.cash} onChange={v => update("cash", v)} />
              <i>+</i><EditableMoney label="Projected income" value={data.income} onChange={v => update("income", v)} />
              <i>−</i><Metric label="Bills & spending" value={directBills + directPurchases} />
              <i>−</i><Metric label="Set aside for later" value={allocations} />
            </div>
          </section>

          <section className="grid">
            <div className="card weekly">
              <div className="card-title"><div><p className="eyebrow">THIS WEEK</p><h2>Budget activity</h2></div><button className="outline" onClick={() => setModal("purchase")}>＋ Add purchase</button></div>
              <div className="activity-head"><span>ITEM</span><span>DATE</span><span>AMOUNT</span></div>
              {[...data.bills.filter(b => inWeek(b.due) && !b.allocationStart).map(b => ({ id:b.id, name:b.biller, date:b.due, amount:b.amount, type:"BILL" })),
                ...data.purchases.filter(p => inWeek(p.date) && !p.allocationStart).map(p => ({ id:p.id, name:p.what, date:p.date, amount:p.amount, type:"PURCHASE" }))].map(x =>
                <div className="activity" key={x.id}><span className={`dot ${x.type === "BILL" ? "bill" : ""}`}></span><div><b>{x.name}</b><small>{x.type}</small></div><time>{pretty(x.date)}</time><strong>−{money(x.amount)}</strong></div>
              )}
              <div className="activity allocation"><span className="dot later"></span><div><b>Future allocations</b><small>SET ASIDE</small></div><time>{allocations ? "Active" : "None"}</time><strong>−{money(allocations)}</strong></div>
              <div className="card-total"><span>Total out this week</span><strong>{money(directBills + directPurchases + allocations)}</strong></div>
            </div>

            <aside className="card upcoming">
              <div className="card-title"><div><p className="eyebrow">CALENDAR</p><h2>Upcoming bills</h2></div><button className="add" onClick={() => setModal("bill")}>＋</button></div>
              <div className="bill-list">
                {upcoming.map(b => <div className="bill-row" key={b.id}><div className="datebox"><b>{pretty(b.due, { day:"2-digit" })}</b><span>{pretty(b.due, { month:"short" }).toUpperCase()}</span></div><div><b>{b.biller}</b><span>{b.frequency}{b.occurrence ? " · scheduled" : ""}</span></div><strong>{money(b.amount)}</strong></div>)}
              </div>
              <button className="full" onClick={() => setModal("bill")}>Add a bill</button>
            </aside>
          </section>

          <section className="later-section">
            <div><p className="eyebrow">PLAN AHEAD</p><h2>Later spending</h2><p>Large expenses, made manageable one week at a time.</p></div>
            <div className="later-list">
              {[...data.bills, ...data.purchases].filter(x => x.allocationStart).map(x => {
                const name = "biller" in x ? x.biller : x.what;
                const due = "due" in x ? x.due : x.date;
                const saved = Math.min(x.amount, Math.max(0, Math.floor((new Date(week).getTime() - new Date(x.allocationStart!).getTime()) / 604800000) + 1) * x.amount / x.installments);
                return <div className="later-card" key={x.id}><div><span className="tag">{pretty(due)}</span><h3>{name}</h3><p>{money(x.amount / x.installments)} per week · {x.installments} weeks</p></div><div className="progress"><span style={{ width: `${Math.min(100, saved / x.amount * 100)}%` }}></span></div><div className="saved"><b>{money(saved)}</b><span>of {money(x.amount)} allocated</span></div></div>
              })}
            </div>
          </section>
        </>
      ) : <Goals data={data} setData={setData} />}

      {modal && <Modal title={modal === "bill" ? "Add an upcoming bill" : "Add a purchase"} close={() => setModal(null)}>
        {modal === "bill" ? <BillForm submit={addBill} week={week} /> : <PurchaseForm submit={addPurchase} week={week} />}
      </Modal>}
    </main>
  );
}

function EditableMoney({ label, value, onChange }: { label:string; value:number; onChange:(n:number)=>void }) {
  return <label className="metric edit"><span>{label} ✎</span><div>$<input aria-label={label} type="number" step=".01" value={value} onChange={e => onChange(Number(e.target.value))}/></div></label>;
}
function Metric({ label, value }: { label:string; value:number }) { return <div className="metric"><span>{label}</span><b>{money(value)}</b></div> }

function Modal({ title, close, children }: { title:string; close:()=>void; children:React.ReactNode }) {
  return <div className="scrim" role="presentation" onMouseDown={e => e.target === e.currentTarget && close()}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button className="close" onClick={close}>×</button><p className="eyebrow">NEW ENTRY</p><h2>{title}</h2>{children}</section></div>;
}
function AllocationFields({ week }: { week:string }) {
  const [on, setOn] = useState(false);
  return <><label className="toggle"><input name="allocate" type="checkbox" checked={on} onChange={e=>setOn(e.target.checked)}/><span></span><div><b>Set money aside in advance</b><small>Deduct portions from earlier weekly budgets</small></div></label>{on && <div className="split"><label>Start deducting<input required name="allocationStart" type="date" defaultValue={week}/></label><label>Number of weeks<input required name="installments" type="number" min="1" max="52" defaultValue="4"/></label></div>}</>;
}
function BillForm({ submit, week }: { submit:(e:FormEvent<HTMLFormElement>)=>void; week:string }) {
  return <form onSubmit={submit}><label>Biller<input required name="biller" placeholder="e.g. Electric company"/></label><div className="split"><label>Amount<input required name="amount" type="number" min="0" step=".01" placeholder="0.00"/></label><label>Due date<input required name="due" type="date" defaultValue={week}/></label></div><label>Repeats<select name="frequency" defaultValue="Monthly"><option>One time</option><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Biannual</option><option>Yearly</option></select></label><AllocationFields week={week}/><button className="primary">Add bill to budget</button></form>;
}
function PurchaseForm({ submit, week }: { submit:(e:FormEvent<HTMLFormElement>)=>void; week:string }) {
  return <form onSubmit={submit}><label>What was it for?<input required name="what" placeholder="e.g. Shipping supplies"/></label><div className="split"><label>Amount<input required name="amount" type="number" min="0" step=".01" placeholder="0.00"/></label><label>Purchase date<input required name="date" type="date" defaultValue={week}/></label></div><AllocationFields week={week}/><button className="primary">Add purchase</button></form>;
}
function Goals({ data, setData }: { data:AppState; setData:React.Dispatch<React.SetStateAction<AppState>> }) {
  const [kind, setKind] = useState<"debt"|"saving">("debt");
  const add = () => setData(d => ({...d, goals:[...d.goals, { id:uid(), name:kind==="debt"?"New debt":"New savings goal", current:0, target:1000, updated:iso(today), kind }]}));
  const change = (id:string, patch:Partial<Goal>) => setData(d => ({...d, goals:d.goals.map(g=>g.id===id?{...g,...patch,updated:iso(today)}:g)}));
  const shown = data.goals.filter(g=>g.kind===kind);
  return <section className="goals-page"><div className="intro"><div><p className="eyebrow">THE BIG PICTURE</p><h1>Build breathing room.</h1><p>Update balances as they change and see how far you’ve come.</p></div><button className="primary compact" onClick={add}>＋ Add {kind === "debt" ? "debt" : "goal"}</button></div><div className="goal-tabs"><button className={kind==="debt"?"active":""} onClick={()=>setKind("debt")}>Debts</button><button className={kind==="saving"?"active":""} onClick={()=>setKind("saving")}>Savings goals</button></div><div className="goal-grid">{shown.map(g => {
    const pct = g.kind==="debt" ? Math.max(0, 100-(g.current/g.target*100)) : Math.min(100,g.current/g.target*100);
    return <article className="goal-card" key={g.id}><span className="goal-icon">{g.kind==="debt"?"↘":"↗"}</span><input className="goal-name" value={g.name} onChange={e=>change(g.id,{name:e.target.value})}/><p>{g.kind==="debt"?"Current balance":"Amount saved"}</p><div className="goal-money">$<input type="number" value={g.current} onChange={e=>change(g.id,{current:Number(e.target.value)})}/></div><div className="goal-progress"><span style={{width:`${pct}%`}}></span></div><div className="goal-meta"><span>{Math.round(pct)}% {g.kind==="debt"?"paid":"funded"}</span><span>Goal {money(g.target)}</span></div><footer>Last updated {pretty(g.updated, {month:"short",day:"numeric",year:"numeric"})}</footer></article>
  })}</div></section>;
}
