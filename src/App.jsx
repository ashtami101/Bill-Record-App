import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutGrid, FileText, PlusCircle, BarChart3, ShieldCheck, Users, Building2,
  Truck, CalendarDays, Settings, HelpCircle, Menu, X, Bell, LogOut, Search,
  Filter, Download, ChevronRight, Clock, CheckCircle2, AlertTriangle, IndianRupee,
  ArrowRight, MapPin, User as UserIcon, FileStack, History, Paperclip
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid, LineChart, Line
} from "recharts";
import { storage } from "./storage";
import { supabase } from "./supabaseClient";

/* ----------------------------- constants ----------------------------- */

const NAVY = "#0B2540";
const TEAL = "#0E7C7B";
const AMBER = "#C97A2B";
const RED = "#B3432B";
const SLATE = "#5B6B79";

const WORKFLOW = [
  { status: "Received at Site", holder: "Site Billing Engineer", stage: "Site Checking" },
  { status: "Primary Checking", holder: "Site Billing Engineer", stage: "Site Checking" },
  { status: "Ready for Runner", holder: "Site Billing Engineer", stage: "Site Checking" },
  { status: "With Runner", holder: "Runner", stage: "Runner" },
  { status: "With Admin", holder: "Admin", stage: "Admin" },
  { status: "Sent to HO", holder: "Admin", stage: "Admin" },
  { status: "HO Checking", holder: "HO Billing Engineer", stage: "HO Billing" },
  { status: "Approved", holder: "HO Billing Engineer", stage: "HO Billing" },
  { status: "Sent to Accounts", holder: "Accounts", stage: "Accounts" },
  { status: "Payment Processing", holder: "Accounts", stage: "Accounts" },
  { status: "Paid", holder: "Accounts", stage: "Accounts" },
];
const STAGE_OF = Object.fromEntries(WORKFLOW.map(w => [w.status, w.stage]));
const HOLDER_OF = Object.fromEntries(WORKFLOW.map(w => [w.status, w.holder]));
const EXCEPTION_HOLDER = {
  "Query Raised": "Contractor", "Returned to Contractor": "Contractor",
  "Rejected": "Closed", "On Hold": "Accounts", "Payment Hold": "Accounts",
};

const STATUS_COLOR = {
  "Received at Site": "#64748B", "Primary Checking": "#2563EB", "Ready for Runner": "#2563EB",
  "With Runner": "#7C3AED", "With Admin": "#7C3AED", "Sent to HO": "#0891B2",
  "HO Checking": "#0891B2", "Approved": "#16A34A", "Sent to Accounts": "#16A34A",
  "Payment Processing": AMBER, "Paid": "#15803D", "Query Raised": "#D97706",
  "Returned to Contractor": "#D97706", "Rejected": "#DC2626", "On Hold": "#DC2626",
  "Payment Hold": "#DC2626",
};

// These are only the *starting* lists — used to seed Supabase the very first time
// the app runs. After that, Projects and Contractors are editable in the app and
// persisted to Supabase (see the "billtrack:projects" / "billtrack:contractors" keys).
const DEFAULT_CONTRACTORS = ["Shree Balaji Construction", "Nova Infra Works", "Om Sai Builders", "Vertex Engineering Pvt Ltd"];
const DEFAULT_SITES = ["Skyline Residency - Tower A", "Skyline Residency - Tower B", "Green Valley Phase 2", "Metro Business Park"];
const BILL_TYPES = ["RA Bill", "Final Bill", "Material Bill", "Other"];
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "bills", label: "All Bills", icon: FileText },
  { id: "new-bill", label: "Register New Bill", icon: PlusCircle },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "management", label: "Management Dashboard", icon: ShieldCheck },
  { id: "users", label: "Users", icon: Users },
  { id: "projects", label: "Projects", icon: Building2 },
  { id: "contractors", label: "Contractors", icon: Truck },
  { id: "holidays", label: "Holidays", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "guide", label: "User Guide", icon: HelpCircle },
];

/* ------------------------------ helpers ------------------------------- */

const fmtINR = (n) => "\u20B9" + Number(n || 0).toLocaleString("en-IN");
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const daysBetween = (a, b) => Math.max(0, Math.round((b - a) / 86400000));
const businessDays = (a, b) => {
  let count = 0; const cur = new Date(a);
  while (cur < b) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
  return count;
};
const uid = () => Math.random().toString(36).slice(2, 10);

function ageingBucket(days) {
  if (days <= 3) return "0-3 Days";
  if (days <= 7) return "4-7 Days";
  if (days <= 15) return "8-15 Days";
  if (days <= 30) return "16-30 Days";
  return "More than 30 Days";
}

function currentHolder(bill) {
  return EXCEPTION_HOLDER[bill.status] || HOLDER_OF[bill.status] || "-";
}

function isOpenBill(bill) {
  return bill.status !== "Paid" && bill.status !== "Rejected";
}

function makeBillId(seq) {
  return `ML-2026-${String(seq).padStart(6, "0")}`;
}

function seedBills() {
  const now = Date.now();
  const day = 86400000;
  const rows = [
    { c: 0, s: 0, type: "RA Bill", gross: 845000, daysAgo: 22, status: "Payment Processing" },
    { c: 1, s: 1, type: "Material Bill", gross: 312000, daysAgo: 9, status: "HO Checking" },
    { c: 2, s: 2, type: "RA Bill", gross: 1240000, daysAgo: 2, status: "Received at Site" },
    { c: 0, s: 3, type: "Final Bill", gross: 2650000, daysAgo: 40, status: "Paid" },
    { c: 3, s: 0, type: "RA Bill", gross: 566000, daysAgo: 6, status: "With Runner" },
    { c: 1, s: 2, type: "Other", gross: 128000, daysAgo: 17, status: "Query Raised" },
    { c: 2, s: 1, type: "RA Bill", gross: 934500, daysAgo: 12, status: "With Admin" },
    { c: 3, s: 3, type: "Material Bill", gross: 245000, daysAgo: 4, status: "Primary Checking" },
    { c: 0, s: 1, type: "RA Bill", gross: 1780000, daysAgo: 28, status: "Sent to Accounts" },
    { c: 1, s: 0, type: "Final Bill", gross: 3120000, daysAgo: 55, status: "Paid" },
  ];
  return rows.map((r, i) => {
    const received = now - r.daysAgo * day;
    const gst = Math.round(r.gross * 0.18);
    const tds = Math.round(r.gross * 0.02);
    const net = r.gross + gst - tds;
    const history = [
      { user: "Priya Nair", role: "Site Billing Engineer", date: received, prevStatus: null, newStatus: "Received at Site", remarks: "Bill received from contractor at site office." },
    ];
    const idxTarget = WORKFLOW.findIndex(w => w.status === r.status);
    for (let k = 1; k <= idxTarget; k++) {
      history.push({
        user: ["Priya Nair", "Ramesh Yadav", "Ajay Kulkarni", "Sunita Rao", "Vikram Shah"][k % 5],
        role: HOLDER_OF[WORKFLOW[k].status],
        date: received + (k * r.daysAgo * day) / (idxTarget + 1),
        prevStatus: WORKFLOW[k - 1].status,
        newStatus: WORKFLOW[k].status,
        remarks: "Processed and forwarded as per workflow.",
      });
    }
    if (r.status === "Query Raised") {
      history.push({ user: "Ajay Kulkarni", role: "HO Billing Engineer", date: received + 3 * day, prevStatus: "HO Checking", newStatus: "Query Raised", remarks: "Measurement sheet mismatch - please clarify quantities for Item 4." });
    }
    return {
      id: makeBillId(i + 1),
      contractor: DEFAULT_CONTRACTORS[r.c], site: DEFAULT_SITES[r.s], building: "Wing " + String.fromCharCode(65 + (i % 3)),
      workOrder: `WO-${2026}-${100 + i}`, po: `PO-${4000 + i}`, contractorBillNo: `CB-${300 + i}`,
      billType: r.type, billDate: received, billPeriod: "Monthly", grossAmount: r.gross, gst, tds,
      otherDeductions: 0, netAmount: net, dateReceived: received, submittedBy: "Priya Nair",
      remarks: "", documents: ["Bill.pdf", "Measurement_Sheet.pdf"],
      status: r.status, history, payment: r.status === "Paid" ? {
        date: received + r.daysAgo * day, amount: net, utr: "UTR" + (100000 + i * 37),
        txn: "TXN" + (900000 + i), voucher: "VCH-" + (2000 + i), mode: "NEFT", bankDetails: "HDFC Bank - 00231",
        remarks: "Payment released.",
      } : null,
    };
  });
}

/* ------------------------------ UI atoms ------------------------------ */

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
        <div className="text-2xl font-bold mt-1" style={{ color: NAVY }}>{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
      </div>
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "1A" }}>
        <Icon size={20} color={color} />
      </div>
    </div>
  );
}

function Badge({ status }) {
  const c = STATUS_COLOR[status] || SLATE;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: c + "18", color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      {status}
    </span>
  );
}

function SectionCard({ title, icon: Icon, action, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-slate-500" />}
          <h3 className="font-semibold text-sm" style={{ color: NAVY }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/40 focus:border-[#0E7C7B]";

/* ------------------------------ Sidebar -------------------------------- */

function Sidebar({ open, onClose, active, setActive }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static z-40 top-0 left-0 h-full w-72 bg-white border-r border-slate-200 transform transition-transform duration-200
        ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: NAVY }}>
              <FileStack size={18} color="white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight" style={{ color: NAVY }}>BillTrack Pro</div>
              <div className="text-[11px] text-slate-400 leading-tight">Contractor Bill Tracking</div>
            </div>
          </div>
          <button className="lg:hidden text-slate-400" onClick={onClose}><X size={20} /></button>
        </div>
        <nav className="py-3 px-3 space-y-0.5 overflow-y-auto" style={{ maxHeight: "calc(100% - 80px)" }}>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => { setActive(item.id); onClose(); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${isActive ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
                style={isActive ? { backgroundColor: NAVY } : {}}>
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function Header({ onMenu, notifCount, userEmail, onLogout }) {
  const initial = (userEmail || "U").charAt(0).toUpperCase();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button className="lg:hidden text-slate-500" onClick={onMenu}><Menu size={22} /></button>
          <div className="hidden lg:block">
            <div className="font-bold text-base" style={{ color: NAVY }}>BillTrack Pro</div>
            <div className="text-xs text-slate-400">Contractor Bill Tracking System</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative text-slate-500">
            <Bell size={20} />
            {notifCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">{notifCount}</span>}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold truncate max-w-[180px]" style={{ color: NAVY }}>{userEmail}</div>
              <div className="text-[11px] text-slate-400">Signed in</div>
            </div>
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: TEAL }}>{initial}</div>
            <button onClick={onLogout} title="Sign out" className="text-slate-400 hover:text-slate-600 hidden sm:block">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------ Dashboard ------------------------------ */

function Dashboard({ bills, setActive }) {
  const stats = useMemo(() => {
    const total = bills.length;
    const totalAmt = bills.reduce((s, b) => s + b.netAmount, 0);
    const pending = bills.filter(isOpenBill);
    const pendingAmt = pending.reduce((s, b) => s + b.netAmount, 0);
    const paid = bills.filter(b => b.status === "Paid");
    const paidAmt = paid.reduce((s, b) => s + b.netAmount, 0);
    const approvedAmt = bills.filter(b => ["Approved", "Sent to Accounts", "Payment Processing", "Paid"].includes(b.status)).reduce((s, b) => s + b.netAmount, 0);
    const underProcessing = bills.filter(b => b.status === "Payment Processing").reduce((s, b) => s + b.netAmount, 0);
    const onHold = bills.filter(b => b.status === "On Hold" || b.status === "Payment Hold").length;
    const rejected = bills.filter(b => b.status === "Rejected").length;
    return { total, totalAmt, pendingAmt, paidAmt, approvedAmt, underProcessing, onHold, rejected };
  }, [bills]);

  const statusDist = useMemo(() => {
    const map = {};
    bills.forEach(b => { map[b.status] = (map[b.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value, color: STATUS_COLOR[name] || SLATE }));
  }, [bills]);

  const ageing = useMemo(() => {
    const buckets = { "0-3 Days": 0, "4-7 Days": 0, "8-15 Days": 0, "16-30 Days": 0, "More than 30 Days": 0 };
    bills.filter(isOpenBill).forEach(b => { buckets[ageingBucket(daysBetween(b.dateReceived, Date.now()))]++; });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [bills]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back, System Administrator. Here's the current bill tracking overview.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Bills" value={stats.total} color={NAVY} />
        <StatCard icon={IndianRupee} label="Total Bill Amount" value={fmtINR(stats.totalAmt)} color="#2563EB" />
        <StatCard icon={Clock} label="Pending Amount" value={fmtINR(stats.pendingAmt)} color={AMBER} />
        <StatCard icon={CheckCircle2} label="Total Paid" value={fmtINR(stats.paidAmt)} color="#16A34A" />
        <StatCard icon={CheckCircle2} label="Approved Amount" value={fmtINR(stats.approvedAmt)} color={TEAL} />
        <StatCard icon={Clock} label="Under Payment Processing" value={fmtINR(stats.underProcessing)} color={AMBER} />
        <StatCard icon={AlertTriangle} label="Bills On Hold" value={stats.onHold} color={RED} />
        <StatCard icon={AlertTriangle} label="Bills Rejected" value={stats.rejected} color={RED} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Bill Status Distribution" icon={BarChart3}>
          {statusDist.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {statusDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Bill Ageing (Open Bills)" icon={Clock}>
          {bills.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ageing}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={TEAL} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Recently Updated Bills" icon={History}
        action={<button onClick={() => setActive("bills")} className="text-xs font-semibold flex items-center gap-1" style={{ color: TEAL }}>View all <ChevronRight size={14} /></button>}>
        <BillMiniList bills={[...bills].sort((a, b) => lastEventTime(b) - lastEventTime(a)).slice(0, 5)} />
      </SectionCard>
    </div>
  );
}

function lastEventTime(bill) { return bill.history[bill.history.length - 1]?.date || bill.dateReceived; }

function Empty({ text = "No data available" }) {
  return <div className="py-14 text-center text-sm text-slate-400">{text}</div>;
}

function BillMiniList({ bills }) {
  if (bills.length === 0) return <Empty />;
  return (
    <div className="divide-y divide-slate-100">
      {bills.map(b => (
        <div key={b.id} className="py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold" style={{ color: NAVY }}>{b.id}</div>
            <div className="text-sm text-slate-600 truncate">{b.contractor} · {b.site}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-semibold" style={{ color: NAVY }}>{fmtINR(b.netAmount)}</span>
            <Badge status={b.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ All Bills ------------------------------ */

function AllBills({ bills, onOpen, setActive }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = bills.filter(b => {
    const matchQ = !q || [b.id, b.contractor, b.contractorBillNo, b.workOrder, b.po, b.site, b.status]
      .join(" ").toLowerCase().includes(q.toLowerCase());
    const matchStatus = statusFilter === "All" || b.status === statusFilter;
    return matchQ && matchStatus;
  });

  const exportCsv = () => {
    const header = ["Bill ID", "Contractor", "Site", "Bill Type", "Bill Date", "Net Amount", "Status", "Current Holder", "Days Pending"];
    const rows = filtered.map(b => [b.id, b.contractor, b.site, b.billType, fmtDate(b.billDate), b.netAmount, b.status, currentHolder(b), daysBetween(b.dateReceived, Date.now())]);
    downloadCsv("all-bills.csv", header, rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>All Bills</h1>
          <p className="text-sm text-slate-500">{filtered.length} bills found</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowFilters(s => !s)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Filter size={15} /> Filters
          </button>
          <button onClick={() => setActive("new-bill")} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: NAVY }}>
            <PlusCircle size={15} /> New Bill
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by Bill ID, Contractor, Bill Number, Work Order, PO, Site, Status..."
            className={inputCls + " pl-9"} />
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            {["All", ...WORKFLOW.map(w => w.status), "Query Raised", "Returned to Contractor", "Rejected", "On Hold"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === s ? "text-white border-transparent" : "text-slate-600 border-slate-300"}`}
                style={statusFilter === s ? { backgroundColor: NAVY } : {}}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? <Empty text="No bills found. Try adjusting your search or filters." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">Bill ID</th>
                  <th className="px-5 py-3 font-semibold">Contractor / Site</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Holder</th>
                  <th className="px-5 py-3 font-semibold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const days = daysBetween(b.dateReceived, Date.now());
                  return (
                    <tr key={b.id} onClick={() => onOpen(b.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer">
                      <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: NAVY }}>{b.id}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-700">{b.contractor}</div>
                        <div className="text-xs text-slate-400">{b.site}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: NAVY }}>{fmtINR(b.netAmount)}</td>
                      <td className="px-5 py-3"><Badge status={b.status} /></td>
                      <td className="px-5 py-3 text-slate-500">{currentHolder(b)}</td>
                      <td className="px-5 py-3">
                        {isOpenBill(b) ? <span className={`font-semibold ${days > 15 ? "text-red-600" : days > 7 ? "text-amber-600" : "text-slate-600"}`}>{days}d</span> : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ---------------------------- Register Bill ----------------------------- */

function RegisterBill({ onCreate, nextId, contractors, sites }) {
  const [form, setForm] = useState({
    contractor: "", site: "", building: "", workOrder: "", po: "", contractorBillNo: "",
    billType: "RA Bill", billDate: new Date().toISOString().slice(0, 10), billPeriod: "",
    grossAmount: "", gst: "", tds: "", otherDeductions: "", submittedBy: "", remarks: "",
  });
  const [error, setError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const net = (Number(form.grossAmount) || 0) + (Number(form.gst) || 0) - (Number(form.tds) || 0) - (Number(form.otherDeductions) || 0);

  const submit = (e) => {
    e.preventDefault();
    if (!form.contractor || !form.site) {
      setError("Please select a Contractor and a Site before submitting.");
      return;
    }
    setError("");
    onCreate({ ...form, grossAmount: Number(form.grossAmount) || 0, gst: Number(form.gst) || 0, tds: Number(form.tds) || 0, otherDeductions: Number(form.otherDeductions) || 0, netAmount: net });
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Register New Bill</h1>
      <p className="text-sm text-slate-500 mt-0.5 mb-5">Create a new contractor bill entry with tracking ID · Next ID: <span className="font-mono font-semibold">{nextId}</span></p>

      <form onSubmit={submit} className="space-y-6">
        <SectionCard title="Bill Details" icon={FileText}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Contractor" required>
              <select className={inputCls} value={form.contractor} onChange={e => set("contractor", e.target.value)}>
                <option value="">Select Contractor</option>
                {contractors.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Site / Project" required>
              <select className={inputCls} value={form.site} onChange={e => set("site", e.target.value)}>
                <option value="">Select Site</option>
                {sites.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Building / Wing"><input className={inputCls} value={form.building} onChange={e => set("building", e.target.value)} /></Field>
            <Field label="Work Order Number"><input className={inputCls} value={form.workOrder} onChange={e => set("workOrder", e.target.value)} /></Field>
            <Field label="PO Number"><input className={inputCls} value={form.po} onChange={e => set("po", e.target.value)} /></Field>
            <Field label="Contractor Bill Number"><input className={inputCls} value={form.contractorBillNo} onChange={e => set("contractorBillNo", e.target.value)} /></Field>
            <Field label="Bill Type" required>
              <select className={inputCls} value={form.billType} onChange={e => set("billType", e.target.value)}>
                {BILL_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Bill Date" required><input type="date" className={inputCls} value={form.billDate} onChange={e => set("billDate", e.target.value)} /></Field>
            <Field label="Bill Period"><input className={inputCls} placeholder="e.g. Jul 2026" value={form.billPeriod} onChange={e => set("billPeriod", e.target.value)} /></Field>
            <Field label="Submitted By"><input className={inputCls} value={form.submittedBy} onChange={e => set("submittedBy", e.target.value)} /></Field>
          </div>
        </SectionCard>

        <SectionCard title="Amounts" icon={IndianRupee}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Gross Bill Amount" required><input type="number" className={inputCls} value={form.grossAmount} onChange={e => set("grossAmount", e.target.value)} /></Field>
            <Field label="GST"><input type="number" className={inputCls} value={form.gst} onChange={e => set("gst", e.target.value)} /></Field>
            <Field label="TDS"><input type="number" className={inputCls} value={form.tds} onChange={e => set("tds", e.target.value)} /></Field>
            <Field label="Other Deductions"><input type="number" className={inputCls} value={form.otherDeductions} onChange={e => set("otherDeductions", e.target.value)} /></Field>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Net Payable Amount</span>
            <span className="text-lg font-bold" style={{ color: NAVY }}>{fmtINR(net)}</span>
          </div>
        </SectionCard>

        <SectionCard title="Documents & Remarks" icon={Paperclip}>
          <Field label="Remarks"><textarea rows={3} className={inputCls} value={form.remarks} onChange={e => set("remarks", e.target.value)} /></Field>
          <div className="mt-4 border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-400">
            Drop Bill PDF, Measurement Sheet, Abstract, Work Order/PO, or other supporting documents here
          </div>
        </SectionCard>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}

        <button type="submit" className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: NAVY }}>
          Register Bill at Site
        </button>
      </form>
    </div>
  );
}

/* ------------------------------ Bill Detail ----------------------------- */

const ACTIONS_BY_STATUS = {
  "Received at Site": [{ label: "Start Checking", to: "Primary Checking" }],
  "Primary Checking": [
    { label: "Primary Check Completed", to: "Ready for Runner" },
    { label: "Query Raised", to: "Query Raised" },
    { label: "Return to Contractor", to: "Returned to Contractor" },
    { label: "Reject", to: "Rejected" },
  ],
  "Ready for Runner": [{ label: "Runner Received Bill", to: "With Runner" }],
  "With Runner": [{ label: "Hand Over to Admin", to: "With Admin" }],
  "With Admin": [
    { label: "Forward to HO", to: "Sent to HO" },
    { label: "Return to Runner/Site", to: "Ready for Runner" },
  ],
  "Sent to HO": [{ label: "Start HO Checking", to: "HO Checking" }],
  "HO Checking": [
    { label: "Approve", to: "Approved" },
    { label: "Query Raised", to: "Query Raised" },
    { label: "Return for Correction", to: "With Admin" },
    { label: "Hold", to: "On Hold" },
    { label: "Reject", to: "Rejected" },
  ],
  "Approved": [{ label: "Send to Accounts", to: "Sent to Accounts" }],
  "Sent to Accounts": [
    { label: "Payment Under Process", to: "Payment Processing" },
    { label: "Payment Hold", to: "Payment Hold" },
  ],
  "Payment Processing": [{ label: "Mark Payment Completed", to: "Paid" }],
  "Query Raised": [{ label: "Resume Checking", to: "Primary Checking" }],
  "On Hold": [{ label: "Resume", to: "HO Checking" }],
  "Payment Hold": [{ label: "Resume Processing", to: "Payment Processing" }],
};

function BillDetail({ bill, onBack, onTransition }) {
  const [remarks, setRemarks] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const days = daysBetween(bill.dateReceived, Date.now());
  const bdays = businessDays(bill.dateReceived, Date.now());
  const actions = ACTIONS_BY_STATUS[bill.status] || [];

  const stageDurations = useMemo(() => {
    const events = bill.history;
    const map = {};
    for (let i = 0; i < events.length; i++) {
      const stage = STAGE_OF[events[i].newStatus] || STAGE_OF[bill.status];
      const start = events[i].date;
      const end = events[i + 1] ? events[i + 1].date : Date.now();
      if (!stage) continue;
      map[stage] = (map[stage] || 0) + (end - start) / 86400000;
    }
    return Object.entries(map).map(([stage, d]) => ({ stage, days: Math.round(d * 10) / 10 }));
  }, [bill]);

  const confirmAction = () => {
    if (!pendingAction) return;
    onTransition(bill.id, pendingAction.to, remarks || pendingAction.label);
    setPendingAction(null); setRemarks("");
  };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm font-medium text-slate-500 flex items-center gap-1">← Back to All Bills</button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-sm text-slate-400">{bill.id}</div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{bill.contractor}</h1>
          <div className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin size={14} /> {bill.site} {bill.building && `· ${bill.building}`}</div>
        </div>
        <Badge status={bill.status} />
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard icon={UserIcon} label="Current Holder" value={currentHolder(bill)} color={TEAL} />
        <StatCard icon={Clock} label="Days Pending" value={isOpenBill(bill) ? `${days}d` : "—"} sub={isOpenBill(bill) ? `${bdays} business days` : "Closed"} color={days > 15 ? RED : AMBER} />
        <StatCard icon={IndianRupee} label="Net Payable" value={fmtINR(bill.netAmount)} color={NAVY} />
        <StatCard icon={FileText} label="Bill Type" value={bill.billType} color="#2563EB" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <SectionCard title="Movement Timeline" icon={History}>
            <div className="space-y-0">
              {bill.history.map((h, i) => (
                <div key={i} className="flex gap-3 pb-5 last:pb-0 relative">
                  {i < bill.history.length - 1 && <div className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />}
                  <div className="h-4 w-4 rounded-full mt-0.5 shrink-0 z-10" style={{ backgroundColor: STATUS_COLOR[h.newStatus] || SLATE }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: NAVY }}>{h.newStatus}</div>
                    <div className="text-xs text-slate-400">{h.user} · {fmtDate(h.date)} at {fmtTime(h.date)}</div>
                    {h.remarks && <div className="text-sm text-slate-600 mt-1">{h.remarks}</div>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {actions.length > 0 && (
            <SectionCard title="Take Action" icon={ArrowRight}>
              <div className="flex flex-wrap gap-2 mb-3">
                {actions.map(a => (
                  <button key={a.label} onClick={() => setPendingAction(a)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium border ${pendingAction?.label === a.label ? "text-white border-transparent" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                    style={pendingAction?.label === a.label ? { backgroundColor: NAVY } : {}}>
                    {a.label}
                  </button>
                ))}
              </div>
              {pendingAction && (
                <div className="space-y-2">
                  <textarea rows={2} placeholder="Add remarks (optional)" className={inputCls} value={remarks} onChange={e => setRemarks(e.target.value)} />
                  <button onClick={confirmAction} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: TEAL }}>
                    Confirm: {pendingAction.label}
                  </button>
                </div>
              )}
            </SectionCard>
          )}

          {bill.payment && (
            <SectionCard title="Payment Details" icon={IndianRupee}>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400">Payment Date: </span>{fmtDate(bill.payment.date)}</div>
                <div><span className="text-slate-400">Paid Amount: </span><span className="font-semibold">{fmtINR(bill.payment.amount)}</span></div>
                <div><span className="text-slate-400">UTR Number: </span><span className="font-mono">{bill.payment.utr}</span></div>
                <div><span className="text-slate-400">Voucher: </span>{bill.payment.voucher}</div>
                <div><span className="text-slate-400">Mode: </span>{bill.payment.mode}</div>
                <div><span className="text-slate-400">Bank: </span>{bill.payment.bankDetails}</div>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="space-y-5">
          <SectionCard title="Bill Summary" icon={FileText}>
            <dl className="text-sm space-y-2.5">
              {[["Work Order", bill.workOrder], ["PO Number", bill.po], ["Contractor Bill No.", bill.contractorBillNo],
              ["Bill Date", fmtDate(bill.billDate)], ["Gross Amount", fmtINR(bill.grossAmount)], ["GST", fmtINR(bill.gst)],
              ["TDS", "- " + fmtINR(bill.tds)], ["Net Payable", fmtINR(bill.netAmount)]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-slate-400">{k}</dt><dd className="font-medium text-right">{v || "—"}</dd></div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Documents" icon={Paperclip}>
            {bill.documents.length === 0 ? <Empty /> : (
              <ul className="space-y-2 text-sm">
                {bill.documents.map(d => (
                  <li key={d} className="flex items-center gap-2 text-slate-600"><FileText size={14} className="text-slate-400" /> {d}</li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Stage-wise Time Spent" icon={Clock}>
            {stageDurations.length === 0 ? <Empty /> : (
              <ul className="space-y-2 text-sm">
                {stageDurations.map(s => (
                  <li key={s.stage} className="flex justify-between"><span className="text-slate-500">{s.stage}</span><span className="font-semibold">{s.days}d</span></li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Reports ------------------------------- */

const REPORT_TABS = [
  { id: "register", label: "Bill Register Report", icon: FileText },
  { id: "pending", label: "Pending Bill Report", icon: Clock },
  { id: "ageing", label: "Bill Ageing Report", icon: AlertTriangle },
  { id: "site", label: "Site-Wise Report", icon: Building2 },
  { id: "contractor", label: "Contractor-Wise Report", icon: Truck },
  { id: "monthly", label: "Monthly Bill Report", icon: BarChart3 },
  { id: "payment", label: "Payment Report", icon: IndianRupee },
  { id: "delay", label: "Department/Stage Delay Report", icon: History },
  { id: "activity", label: "User Activity Report", icon: Users },
];

function Reports({ bills }) {
  const [tab, setTab] = useState("register");
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Reports</h1>
          <p className="text-sm text-slate-500">Generate and export detailed reports</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <FileText size={15} /> Print / PDF
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map(t => {
          const Icon = t.icon; const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border ${isActive ? "text-white border-transparent" : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"}`}
              style={isActive ? { backgroundColor: NAVY } : {}}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "register" && <BillRegisterReport bills={bills} />}
      {tab === "pending" && <PendingBillReport bills={bills} />}
      {tab === "ageing" && <AgeingReport bills={bills} />}
      {tab === "site" && <GroupedReport bills={bills} groupKey="site" title="Site-Wise Report" icon={Building2} />}
      {tab === "contractor" && <GroupedReport bills={bills} groupKey="contractor" title="Contractor-Wise Report" icon={Truck} />}
      {tab === "monthly" && <MonthlyReport bills={bills} />}
      {tab === "payment" && <PaymentReport bills={bills} />}
      {tab === "delay" && <DelayReport bills={bills} />}
      {tab === "activity" && <ActivityReport bills={bills} />}
    </div>
  );
}

function ReportShell({ title, count, onExport, children }) {
  return (
    <SectionCard title={`${title}${count !== undefined ? ` (${count})` : ""}`}
      action={<button onClick={onExport} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: TEAL }}><Download size={14} /> Export CSV</button>}>
      {children}
    </SectionCard>
  );
}

function Table({ cols, rows }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto -mx-5 -mb-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
            {cols.map(c => <th key={c} className="px-5 py-3 font-semibold whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              {r.map((v, j) => <td key={j} className="px-5 py-3 whitespace-nowrap">{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillRegisterReport({ bills }) {
  const cols = ["Bill ID", "Contractor", "Site", "Type", "Bill Date", "Amount", "Status", "Holder", "Pending"];
  const rows = bills.map(b => [b.id, b.contractor, b.site, b.billType, fmtDate(b.billDate), fmtINR(b.netAmount), <Badge key={b.id} status={b.status} />, currentHolder(b), isOpenBill(b) ? daysBetween(b.dateReceived, Date.now()) + "d" : "—"]);
  return <ReportShell title="Bill Register Report" count={bills.length} onExport={() => downloadCsv("bill-register.csv", cols, bills.map(b => [b.id, b.contractor, b.site, b.billType, fmtDate(b.billDate), b.netAmount, b.status, currentHolder(b), daysBetween(b.dateReceived, Date.now())]))}>
    <Table cols={cols} rows={rows} />
  </ReportShell>;
}

function PendingBillReport({ bills }) {
  const pending = bills.filter(isOpenBill);
  const cols = ["Bill ID", "Contractor", "Site", "Stage", "Holder", "Amount", "Received", "Pending Days"];
  const rows = pending.map(b => {
    const d = daysBetween(b.dateReceived, Date.now());
    return [b.id, b.contractor, b.site, b.status, currentHolder(b), fmtINR(b.netAmount), fmtDate(b.dateReceived), <span key={b.id} className={d > 15 ? "text-red-600 font-semibold" : d > 7 ? "text-amber-600 font-semibold" : ""}>{d}d</span>];
  });
  return <ReportShell title="Pending Bill Report" count={pending.length} onExport={() => downloadCsv("pending-bills.csv", cols, pending.map(b => [b.id, b.contractor, b.site, b.status, currentHolder(b), b.netAmount, fmtDate(b.dateReceived), daysBetween(b.dateReceived, Date.now())]))}>
    <Table cols={cols} rows={rows} />
  </ReportShell>;
}

function AgeingReport({ bills }) {
  const buckets = ["0-3 Days", "4-7 Days", "8-15 Days", "16-30 Days", "More than 30 Days"];
  const data = buckets.map(name => {
    const set = bills.filter(b => isOpenBill(b) && ageingBucket(daysBetween(b.dateReceived, Date.now())) === name);
    return { name, count: set.length, amount: set.reduce((s, b) => s + b.netAmount, 0) };
  });
  return (
    <ReportShell title="Bill Ageing Report" onExport={() => downloadCsv("bill-ageing.csv", ["Bucket", "Bills", "Amount"], data.map(d => [d.name, d.count, d.amount]))}>
      <div className="grid sm:grid-cols-5 gap-3 mb-5">
        {data.map(d => (
          <div key={d.name} className="rounded-xl border border-slate-200 p-3 text-center">
            <div className="text-xs text-slate-400">{d.name}</div>
            <div className="text-xl font-bold mt-1" style={{ color: NAVY }}>{d.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{fmtINR(d.amount)}</div>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill={AMBER} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ReportShell>
  );
}

function GroupedReport({ bills, groupKey, title, icon }) {
  const groups = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      const k = b[groupKey];
      if (!map[k]) map[k] = { name: k, total: 0, totalAmt: 0, pending: 0, pendingAmt: 0, approved: 0, paid: 0, paidAmt: 0 };
      const g = map[k];
      g.total++; g.totalAmt += b.netAmount;
      if (isOpenBill(b)) { g.pending++; g.pendingAmt += b.netAmount; }
      if (["Approved", "Sent to Accounts", "Payment Processing", "Paid"].includes(b.status)) g.approved += b.netAmount;
      if (b.status === "Paid") { g.paid++; g.paidAmt += b.netAmount; }
    });
    return Object.values(map);
  }, [bills, groupKey]);

  const cols = ["Name", "Total Bills", "Total Amount", "Pending", "Pending Amount", "Approved Amount", "Paid Bills", "Paid Amount"];
  const rows = groups.map(g => [g.name, g.total, fmtINR(g.totalAmt), g.pending, fmtINR(g.pendingAmt), fmtINR(g.approved), g.paid, fmtINR(g.paidAmt)]);
  return <ReportShell title={title} count={groups.length} onExport={() => downloadCsv(title.toLowerCase().replace(/\s+/g, "-") + ".csv", cols, groups.map(g => [g.name, g.total, g.totalAmt, g.pending, g.pendingAmt, g.approved, g.paid, g.paidAmt]))}>
    <Table cols={cols} rows={rows} />
  </ReportShell>;
}

function MonthlyReport({ bills }) {
  const data = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      const key = new Date(b.billDate).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { month: key, received: 0, value: 0, approved: 0, approvedValue: 0, paid: 0, paidValue: 0, pending: 0, pendingValue: 0 };
      const m = map[key];
      m.received++; m.value += b.netAmount;
      if (["Approved", "Sent to Accounts", "Payment Processing", "Paid"].includes(b.status)) { m.approved++; m.approvedValue += b.netAmount; }
      if (b.status === "Paid") { m.paid++; m.paidValue += b.netAmount; }
      if (isOpenBill(b)) { m.pending++; m.pendingValue += b.netAmount; }
    });
    return Object.values(map);
  }, [bills]);
  const cols = ["Month", "Received", "Value", "Approved", "Approved Value", "Paid", "Paid Value", "Pending", "Pending Value"];
  const rows = data.map(m => [m.month, m.received, fmtINR(m.value), m.approved, fmtINR(m.approvedValue), m.paid, fmtINR(m.paidValue), m.pending, fmtINR(m.pendingValue)]);
  return (
    <ReportShell title="Monthly Bill Report" onExport={() => downloadCsv("monthly-report.csv", cols, data.map(m => [m.month, m.received, m.value, m.approved, m.approvedValue, m.paid, m.paidValue, m.pending, m.pendingValue]))}>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => fmtINR(v)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="value" name="Bill Value" stroke="#2563EB" strokeWidth={2} />
          <Line type="monotone" dataKey="paidValue" name="Paid Value" stroke="#16A34A" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-5"><Table cols={cols} rows={rows} /></div>
    </ReportShell>
  );
}

function PaymentReport({ bills }) {
  const paid = bills.filter(b => b.payment);
  const cols = ["Bill ID", "Contractor", "Site", "Approved Amount", "Paid Amount", "Payment Date", "UTR", "Voucher", "Status"];
  const rows = paid.map(b => [b.id, b.contractor, b.site, fmtINR(b.netAmount), fmtINR(b.payment.amount), fmtDate(b.payment.date), b.payment.utr, b.payment.voucher, "Paid"]);
  return <ReportShell title="Payment Report" count={paid.length} onExport={() => downloadCsv("payment-report.csv", cols, paid.map(b => [b.id, b.contractor, b.site, b.netAmount, b.payment.amount, fmtDate(b.payment.date), b.payment.utr, b.payment.voucher, "Paid"]))}>
    <Table cols={cols} rows={rows} />
  </ReportShell>;
}

function DelayReport({ bills }) {
  const stageMap = {};
  bills.forEach(b => {
    const events = b.history;
    for (let i = 0; i < events.length; i++) {
      const stage = STAGE_OF[events[i].newStatus];
      if (!stage) continue;
      const start = events[i].date;
      const end = events[i + 1] ? events[i + 1].date : Date.now();
      if (!stageMap[stage]) stageMap[stage] = { total: 0, count: 0 };
      stageMap[stage].total += (end - start) / 86400000;
      stageMap[stage].count++;
    }
  });
  const data = Object.entries(stageMap).map(([stage, v]) => ({ stage, avg: Math.round((v.total / v.count) * 10) / 10 })).sort((a, b) => b.avg - a.avg);
  const cols = ["Stage", "Average Days"];
  return (
    <ReportShell title="Department / Stage Delay Report" onExport={() => downloadCsv("stage-delay.csv", cols, data.map(d => [d.stage, d.avg]))}>
      {data.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Highest average delay: <strong>{data[0].stage}</strong> at {data[0].avg} days per bill.
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F4" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={100} />
          <Tooltip />
          <Bar dataKey="avg" fill={RED} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-5"><Table cols={cols} rows={data.map(d => [d.stage, d.avg + "d"])} /></div>
    </ReportShell>
  );
}

function ActivityReport({ bills }) {
  const events = [];
  bills.forEach(b => b.history.forEach(h => events.push({ ...h, billId: b.id })));
  events.sort((a, b) => b.date - a.date);
  const cols = ["User", "Bill ID", "Date", "Time", "Previous", "New Status", "Remarks"];
  const rows = events.slice(0, 100).map((h, i) => [h.user, h.billId, fmtDate(h.date), fmtTime(h.date), h.prevStatus || "—", h.newStatus, h.remarks || "—"]);
  return <ReportShell title="User Activity Report" count={events.length} onExport={() => downloadCsv("user-activity.csv", cols, events.map(h => [h.user, h.billId, fmtDate(h.date), fmtTime(h.date), h.prevStatus || "-", h.newStatus, h.remarks || ""]))}>
    <Table cols={cols} rows={rows} />
  </ReportShell>;
}

/* --------------------------- Management Dashboard ------------------------ */

function ManagementDashboard({ bills }) {
  const total = bills.length;
  const pending = bills.filter(isOpenBill);
  const approved = bills.filter(b => ["Approved", "Sent to Accounts", "Payment Processing", "Paid"].includes(b.status));
  const paid = bills.filter(b => b.status === "Paid");

  const monthly = useMemo(() => {
    const map = {};
    bills.forEach(b => {
      const key = new Date(b.billDate).toLocaleDateString("en-IN", { month: "short" });
      map[key] = (map[key] || 0) + b.netAmount;
    });
    return Object.entries(map).map(([month, amount]) => ({ month, amount }));
  }, [bills]);

  const paymentMonthly = useMemo(() => {
    const map = {};
    bills.filter(b => b.payment).forEach(b => {
      const key = new Date(b.payment.date).toLocaleDateString("en-IN", { month: "short" });
      map[key] = (map[key] || 0) + b.payment.amount;
    });
    return Object.entries(map).map(([month, amount]) => ({ month, amount }));
  }, [bills]);

  const siteWise = useMemo(() => {
    const map = {};
    pending.forEach(b => { map[b.site] = (map[b.site] || 0) + b.netAmount; });
    return Object.entries(map).map(([name, amount]) => ({ name, amount }));
  }, [pending]);

  const contractorWise = useMemo(() => {
    const map = {};
    pending.forEach(b => { map[b.contractor] = (map[b.contractor] || 0) + b.netAmount; });
    return Object.entries(map).map(([name, amount]) => ({ name, amount }));
  }, [pending]);

  const ageing = useMemo(() => {
    const buckets = { "0-3 Days": 0, "4-7 Days": 0, "8-15 Days": 0, "16-30 Days": 0, "More than 30 Days": 0 };
    pending.forEach(b => { buckets[ageingBucket(daysBetween(b.dateReceived, Date.now()))]++; });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [pending]);

  const stageMap = {};
  bills.forEach(b => {
    const events = b.history;
    for (let i = 0; i < events.length; i++) {
      const stage = STAGE_OF[events[i].newStatus]; if (!stage) continue;
      const start = events[i].date; const end = events[i + 1] ? events[i + 1].date : Date.now();
      if (!stageMap[stage]) stageMap[stage] = { total: 0, count: 0 };
      stageMap[stage].total += (end - start) / 86400000; stageMap[stage].count++;
    }
  });
  const delayData = Object.entries(stageMap).map(([stage, v]) => ({ stage, avg: Math.round((v.total / v.count) * 10) / 10 }));

  const oldest = [...pending].sort((a, b) => a.dateReceived - b.dateReceived).slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Management Dashboard</h1>
        <p className="text-sm text-slate-500">High-level overview of bill tracking and payment status</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Total Bills" value={total} color={NAVY} />
        <StatCard icon={Clock} label="Total Pending" value={pending.length} color={AMBER} />
        <StatCard icon={IndianRupee} label="Pending Amount" value={fmtINR(pending.reduce((s, b) => s + b.netAmount, 0))} color={AMBER} />
        <StatCard icon={CheckCircle2} label="Approved" value={approved.length} color={TEAL} />
        <StatCard icon={CheckCircle2} label="Total Paid" value={paid.length} color="#16A34A" />
        <StatCard icon={IndianRupee} label="Paid Amount" value={fmtINR(paid.reduce((s, b) => s + b.netAmount, 0))} color="#16A34A" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Monthly Bill Amount" icon={BarChart3}>
          {monthly.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={v => fmtINR(v)} /><Bar dataKey="amount" fill="#2563EB" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Monthly Payment Amount" icon={IndianRupee}>
          {paymentMonthly.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={paymentMonthly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={v => fmtINR(v)} /><Bar dataKey="amount" fill="#16A34A" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Site-wise Pending Amount" icon={Building2}>
          {siteWise.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={siteWise} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F4" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} /><Tooltip formatter={v => fmtINR(v)} /><Bar dataKey="amount" fill={TEAL} radius={[0, 6, 6, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Contractor-wise Outstanding" icon={Truck}>
          {contractorWise.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={contractorWise} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F4" /><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} /><Tooltip formatter={v => fmtINR(v)} /><Bar dataKey="amount" fill={AMBER} radius={[0, 6, 6, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Bill Ageing" icon={Clock}>
          {ageing.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageing}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#7C3AED" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
        <SectionCard title="Department-wise Delay" icon={AlertTriangle}>
          {delayData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={delayData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" /><XAxis dataKey="stage" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="avg" fill={RED} radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Top 10 Oldest Pending Bills" icon={AlertTriangle}>
        <Table cols={["Bill ID", "Contractor", "Site", "Holder", "Amount", "Days Pending"]}
          rows={oldest.map(b => [b.id, b.contractor, b.site, currentHolder(b), fmtINR(b.netAmount), <span key={b.id} className="text-red-600 font-semibold">{daysBetween(b.dateReceived, Date.now())}d</span>])} />
      </SectionCard>
    </div>
  );
}

/* ------------------------------ Simple pages ---------------------------- */

function SimpleListPage({ title, sub, items, icon: Icon }) {
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold" style={{ color: NAVY }}>{title}</h1><p className="text-sm text-slate-500">{sub}</p></div>
      <SectionCard title={title} icon={Icon}>
        <ul className="divide-y divide-slate-100">
          {items.map(it => <li key={it} className="py-3 text-sm text-slate-700 flex items-center gap-2"><Icon size={15} className="text-slate-400" />{it}</li>)}
        </ul>
      </SectionCard>
    </div>
  );
}

function ManagedListPage({ title, sub, items, icon: Icon, onAdd, onDelete, placeholder, singular }) {
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const trimmed = newItem.trim();
    if (!trimmed) { setError(`Enter a ${singular.toLowerCase()} name.`); return; }
    if (items.some(it => it.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already on the list.`);
      return;
    }
    setError("");
    onAdd(trimmed);
    setNewItem("");
  };

  const remove = (item) => {
    if (window.confirm(`Remove "${item}"? Existing bills that reference it will keep showing this name — this only affects the dropdown for new bills.`)) {
      onDelete(item);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>{title}</h1>
        <p className="text-sm text-slate-500">{sub}</p>
      </div>

      <SectionCard title={`Add ${singular}`} icon={PlusCircle}>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <input
            className={inputCls}
            placeholder={placeholder}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button type="submit" className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold shrink-0" style={{ backgroundColor: NAVY }}>
            Add {singular}
          </button>
        </form>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
      </SectionCard>

      <SectionCard title={title} icon={Icon}>
        {items.length === 0 ? (
          <Empty text={`No ${title.toLowerCase()} yet — add one above.`} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it} className="py-3 flex items-center justify-between gap-2">
                <span className="text-sm text-slate-700 flex items-center gap-2 min-w-0">
                  <Icon size={15} className="text-slate-400 shrink-0" />
                  <span className="truncate">{it}</span>
                </span>
                <button
                  onClick={() => remove(it)}
                  title={`Remove ${it}`}
                  className="text-slate-400 hover:text-red-600 shrink-0 p-1"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function GuidePage() {
  const steps = [
    ["Contractor submits bill", "Physical/digital bill handed to the Site Billing Engineer."],
    ["Site Primary Checking", "Site Billing Engineer verifies documents and marks checking complete."],
    ["Runner Boy", "Collects the physical bill and hands it to Admin."],
    ["Admin", "Confirms receipt, verifies documents, forwards to HO."],
    ["HO Billing Engineer", "Performs detailed checking and approves, queries, or rejects."],
    ["Accounts", "Processes payment and marks the bill as Paid."],
  ];
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold" style={{ color: NAVY }}>User Guide</h1><p className="text-sm text-slate-500">How a bill moves through BillTrack Pro, end to end.</p></div>
      <SectionCard title="Workflow Overview" icon={HelpCircle}>
        <div className="space-y-4">
          {steps.map(([t, d], i) => (
            <div key={t} className="flex gap-3">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: NAVY }}>{i + 1}</div>
              <div><div className="font-semibold text-sm" style={{ color: NAVY }}>{t}</div><div className="text-sm text-slate-500">{d}</div></div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* --------------------------------- App ---------------------------------- */

export default function App({ user, onLogout }) {
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bills, setBills] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [openBillId, setOpenBillId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Bills, Projects, and Contractors are shared company-wide data: every
  // signed-in user reads/writes the same records (shared=true), rather than
  // a private copy each. Projects/Contractors are only seeded with the
  // defaults the first time the app ever runs — after that, whatever's in
  // Supabase wins, and adding/removing from the app updates Supabase directly.
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("billtrack:bills", true);
        if (res && res.value) {
          setBills(JSON.parse(res.value));
        } else {
          const seeded = seedBills();
          setBills(seeded);
          await storage.set("billtrack:bills", JSON.stringify(seeded), true);
        }
      } catch (e) {
        console.error("Failed to load bills from Supabase:", e);
        setBills(seedBills());
      }

      try {
        const res = await storage.get("billtrack:projects", true);
        if (res && res.value) {
          setProjects(JSON.parse(res.value));
        } else {
          setProjects(DEFAULT_SITES);
          await storage.set("billtrack:projects", JSON.stringify(DEFAULT_SITES), true);
        }
      } catch (e) {
        console.error("Failed to load projects from Supabase:", e);
        setProjects(DEFAULT_SITES);
      }

      try {
        const res = await storage.get("billtrack:contractors", true);
        if (res && res.value) {
          setContractors(JSON.parse(res.value));
        } else {
          setContractors(DEFAULT_CONTRACTORS);
          await storage.set("billtrack:contractors", JSON.stringify(DEFAULT_CONTRACTORS), true);
        }
      } catch (e) {
        console.error("Failed to load contractors from Supabase:", e);
        setContractors(DEFAULT_CONTRACTORS);
      }

      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setBills(next);
    try { await storage.set("billtrack:bills", JSON.stringify(next), true); } catch (e) { console.error("Failed to save bills:", e); }
  }, []);

  const persistProjects = useCallback(async (next) => {
    setProjects(next);
    try { await storage.set("billtrack:projects", JSON.stringify(next), true); } catch (e) { console.error("Failed to save projects:", e); }
  }, []);

  const persistContractors = useCallback(async (next) => {
    setContractors(next);
    try { await storage.set("billtrack:contractors", JSON.stringify(next), true); } catch (e) { console.error("Failed to save contractors:", e); }
  }, []);

  const addProject = useCallback((name) => persistProjects([...projects, name]), [projects, persistProjects]);
  const deleteProject = useCallback((name) => persistProjects(projects.filter((p) => p !== name)), [projects, persistProjects]);
  const addContractor = useCallback((name) => persistContractors([...contractors, name]), [contractors, persistContractors]);
  const deleteContractor = useCallback((name) => persistContractors(contractors.filter((c) => c !== name)), [contractors, persistContractors]);

  const handleCreate = useCallback((form) => {
    const nextSeq = bills.length + 1;
    const id = makeBillId(nextSeq);
    const now = Date.now();
    const bill = {
      id, contractor: form.contractor, site: form.site, building: form.building,
      workOrder: form.workOrder, po: form.po, contractorBillNo: form.contractorBillNo,
      billType: form.billType, billDate: new Date(form.billDate).getTime(), billPeriod: form.billPeriod,
      grossAmount: form.grossAmount, gst: form.gst, tds: form.tds, otherDeductions: form.otherDeductions,
      netAmount: form.netAmount, dateReceived: now, submittedBy: form.submittedBy || "Site Billing Engineer",
      remarks: form.remarks, documents: [], status: "Received at Site",
      history: [{ user: form.submittedBy || "Site Billing Engineer", role: "Site Billing Engineer", date: now, prevStatus: null, newStatus: "Received at Site", remarks: "Bill registered at site." }],
      payment: null,
    };
    persist([bill, ...bills]);
    setOpenBillId(id);
    setActive("bills");
  }, [bills, persist]);

  const handleTransition = useCallback((billId, toStatus, remarks) => {
    const now = Date.now();
    const next = bills.map(b => {
      if (b.id !== billId) return b;
      const updated = {
        ...b, status: toStatus,
        history: [...b.history, { user: user?.email || "Unknown user", role: currentHolder({ ...b, status: toStatus }), date: now, prevStatus: b.status, newStatus: toStatus, remarks }],
      };
      if (toStatus === "Paid") {
        updated.payment = { date: now, amount: b.netAmount, utr: "UTR" + Math.floor(Math.random() * 900000 + 100000), txn: "TXN" + Math.floor(Math.random() * 900000), voucher: "VCH-" + Math.floor(Math.random() * 9000 + 1000), mode: "NEFT", bankDetails: "HDFC Bank - 00231", remarks: remarks || "Payment released." };
      }
      return updated;
    });
    persist(next);
  }, [bills, persist, user]);

  const notifCount = bills.filter(b => isOpenBill(b) && daysBetween(b.dateReceived, Date.now()) > 7).length;
  const openBill = bills.find(b => b.id === openBillId);

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Loading BillTrack Pro…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} active={active} setActive={(id) => { setActive(id); setOpenBillId(null); }} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header onMenu={() => setSidebarOpen(true)} notifCount={notifCount} userEmail={user?.email} onLogout={onLogout} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {active === "dashboard" && <Dashboard bills={bills} setActive={setActive} />}
          {active === "bills" && !openBill && <AllBills bills={bills} onOpen={setOpenBillId} setActive={setActive} />}
          {active === "bills" && openBill && <BillDetail bill={openBill} onBack={() => setOpenBillId(null)} onTransition={handleTransition} />}
          {active === "new-bill" && <RegisterBill onCreate={handleCreate} nextId={makeBillId(bills.length + 1)} contractors={contractors} sites={projects} />}
          {active === "reports" && <Reports bills={bills} />}
          {active === "management" && <ManagementDashboard bills={bills} />}
          {active === "users" && <SimpleListPage title="Users" sub="Manage user roles and access" icon={Users}
            items={["System Administrator — Super Admin", "Priya Nair — Site Billing Engineer", "Ramesh Yadav — Runner Boy", "Ajay Kulkarni — HO Billing Engineer", "Sunita Rao — Admin", "Vikram Shah — Accounts"]} />}
          {active === "projects" && (
            <ManagedListPage
              title="Projects" sub="Sites and projects under tracking" icon={Building2} singular="Project"
              placeholder="e.g. Lakeview Heights - Tower C"
              items={projects} onAdd={addProject} onDelete={deleteProject}
            />
          )}
          {active === "contractors" && (
            <ManagedListPage
              title="Contractors" sub="Registered contractors" icon={Truck} singular="Contractor"
              placeholder="e.g. Everest Construction Co."
              items={contractors} onAdd={addContractor} onDelete={deleteContractor}
            />
          )}
          {active === "holidays" && <SimpleListPage title="Holidays" sub="Excluded from working-day pending calculations" icon={CalendarDays}
            items={["26 Jan 2026 — Republic Day", "15 Aug 2026 — Independence Day", "02 Oct 2026 — Gandhi Jayanti", "25 Dec 2026 — Christmas"]} />}
          {active === "settings" && <SimpleListPage title="Settings" sub="System configuration" icon={Settings}
            items={["Bill ID prefix: ML-2026-", "Escalation: reminder at 3 days, warning at 7 days, escalate at 15 days", "Currency: INR (₹)", "Session timeout: 30 minutes"]} />}
          {active === "guide" && <GuidePage />}
        </main>
      </div>
    </div>
  );
}
