"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, ChartNoAxesCombined,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Download,
  FileSpreadsheet, FolderOpen, HardHat, Layers3, Menu, Package, Plus, Search,
  SlidersHorizontal, Trash2, UploadCloud, Users, Wallet, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import type { DashboardData, Entry } from "@/lib/types";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const integer = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
const shortMoney = (value: number) => value >= 1e9 ? `Rp ${(value / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
  : value >= 1e6 ? `Rp ${(value / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  : value >= 1e3 ? `Rp ${(value / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb` : money(value);
const monthLabel = (month: string) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
const dateLabel = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};
const usageCode = (note: string) => note.replace(/^usagews\s*#\s*/i, "").trim() || "—";
const EMPTY: DashboardData = { entries: [], sources: [], toolCount: 0, workerCount: 0, duplicateRows: 0 };

type Summary = { name: string; qty: number; cost: number; rows: number; tools: Set<string>; division?: string };
type ToolSummary = { code: string; name: string; unit: string; qty: number; cost: number; rows: number };

function groupPeople(entries: Entry[], field: "worker" | "division") {
  const map = new Map<string, Summary>();
  for (const item of entries) {
    const name = item[field];
    const current = map.get(name) ?? { name, qty: 0, cost: 0, rows: 0, tools: new Set<string>(), division: item.division };
    current.qty += item.qty;
    current.cost += item.cost;
    current.rows++;
    current.tools.add(item.code.toUpperCase());
    map.set(name, current);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.qty - a.qty || a.name.localeCompare(b.name));
}

function groupTools(entries: Entry[]) {
  const map = new Map<string, ToolSummary>();
  for (const item of entries) {
    const key = item.code.toUpperCase();
    const current = map.get(key) ?? { code: item.code, name: item.name, unit: item.unit, qty: 0, cost: 0, rows: 0 };
    current.qty += item.qty;
    current.cost += item.cost;
    current.rows++;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.qty - a.qty);
}

function csvCell(value: string | number) {
  let string = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(string)) string = `'${string}`;
  return `"${string.replaceAll('"', '""')}"`;
}

function exportCsv(rows: Entry[], month: string) {
  const headers = ["Tanggal", "Kode usage", "Nama tukang", "Divisi", "Admin", "Kode alat", "Nama alat", "Satuan", "Qty", "Harga satuan", "Total harga"];
  const values = rows.map((row) => [
    row.date, usageCode(row.note), row.worker, row.division, row.admin, row.code, row.name,
    row.unit, row.qty, row.price ?? "", row.cost,
  ]);
  const content = "\uFEFF" + [headers, ...values].map((line) => line.map(csvCell).join(";")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  link.download = `pemakaian-alat-${month || "semua"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ChartTooltip({ active, payload, label, unit = "cost" }: {
  active?: boolean; payload?: { value?: number }[]; label?: string | number; unit?: "cost" | "qty";
}) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><span>{label}</span><strong>{unit === "cost" ? money(payload[0].value ?? 0) : `${integer(payload[0].value ?? 0)} unit`}</strong></div>;
}

export default function Dashboard({ staticDataUrl }: { staticDataUrl?: string } = {}) {
  const isStatic = Boolean(staticDataUrl);
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState("");
  const [division, setDivision] = useState("");
  const [worker, setWorker] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedDivision, setExpandedDivision] = useState("");
  const [toolSort, setToolSort] = useState<"cost" | "qty">("cost");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeNav, setActiveNav] = useState("ringkasan");
  const [mobileMenu, setMobileMenu] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(staticDataUrl ?? "/api/data").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Gagal memuat data.");
      setData(body);
    }).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, [staticDataUrl]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".table-scroll").forEach((element) => {
      element.tabIndex = 0;
      element.setAttribute("aria-label", `Tabel ${element.closest("section")?.querySelector("h2")?.textContent ?? "data"}. Geser mendatar untuk melihat semua kolom.`);
    });
  }, []);

  const months = useMemo(() =>
    [...new Set(data.entries.map((item) => item.date.slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)))].sort().reverse(),
    [data.entries]);
  useEffect(() => {
    if (months.length && (!month || !months.includes(month))) setMonth(months.includes("2026-10") ? "2026-10" : months[0]);
  }, [months, month]);

  const monthEntries = useMemo(() => data.entries.filter((item) => item.date.startsWith(month)), [data.entries, month]);
  const divisionOptions = useMemo(() => [...new Set(monthEntries.map((item) => item.division))].sort(), [monthEntries]);
  const workerOptions = useMemo(() => [...new Set(monthEntries.filter((item) => !division || item.division === division).map((item) => item.worker))].sort(), [monthEntries, division]);
  const filtered = useMemo(() => monthEntries.filter((item) =>
    (!division || item.division === division) && (!worker || item.worker === worker)
    && (!from || item.date.slice(0, 10) >= from) && (!to || item.date.slice(0, 10) <= to)),
  [monthEntries, division, worker, from, to]);
  const people = useMemo(() => groupPeople(filtered, "worker"), [filtered]);
  const divisions = useMemo(() => groupPeople(filtered, "division"), [filtered]);
  const tools = useMemo(() => groupTools(filtered), [filtered]);
  const searched = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    return filtered.filter((item) => !term || [item.worker, item.division, item.admin, item.code, item.name, item.note, item.unit, item.date]
      .some((value) => value.toLocaleLowerCase("id-ID").includes(term))).sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered, search]);
  useEffect(() => { setPage(1); }, [month, division, worker, from, to, search]);
  const totalCost = filtered.reduce((sum, item) => sum + item.cost, 0);
  const totalQty = filtered.reduce((sum, item) => sum + item.qty, 0);
  const usageCount = new Set(filtered.map((item) => item.note || `${item.date}-${item.worker}-${item.code}`)).size;
  const missingPrice = filtered.filter((item) => item.priceMissing).length;
  const missingDivision = filtered.filter((item) => item.divisionMissing).length;
  const daily = useMemo(() => {
    if (!month) return [];
    const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    const map = new Map<string, { day: string; cost: number; qty: number }>();
    for (let day = 1; day <= days; day++) {
      const key = `${month}-${String(day).padStart(2, "0")}`;
      map.set(key, { day: String(day).padStart(2, "0"), cost: 0, qty: 0 });
    }
    for (const entry of filtered) {
      const record = map.get(entry.date.slice(0, 10));
      if (record) { record.cost += entry.cost; record.qty += entry.qty; }
    }
    return [...map.values()];
  }, [filtered, month]);

  const jump = (id: string) => {
    setActiveNav(id);
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const focusWorker = (name: string) => { setWorker(name); jump("transaksi"); };
  const focusDivision = (name: string) => { setDivision(name); setWorker(""); jump("transaksi"); };
  const resetFilters = () => { setDivision(""); setWorker(""); setFrom(""); setTo(""); setSearch(""); };

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    if (isStatic) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    setUploading(true); setError(""); setNotice("");
    const form = new FormData();
    selected.forEach((file) => form.append("files", file));
    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Upload gagal.");
      const incomingMonths: string[] = [...new Set<string>(body.entries.map((item: Entry) => item.date.slice(0, 7)))].sort().reverse();
      const newest = incomingMonths.find((item) => !months.includes(item));
      if (newest) { setMonth(newest); setDivision(""); setWorker(""); setFrom(""); setTo(""); }
      setData(body);
      const result = body.result as { added: number; skipped: number; errors: string[] };
      setNotice(`${result.added} file ditambahkan${result.skipped ? `, ${result.skipped} file identik dilewati` : ""}.${result.errors.length ? ` ${result.errors.join(" ")}` : ""}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload gagal.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }, [isStatic, months]);

  const removeFile = async (id: string, name: string) => {
    if (isStatic) return;
    if (!window.confirm(`Hapus sumber "${name}" dari dashboard? Data file lain tetap tersimpan.`)) return;
    setError(""); setNotice("");
    try {
      const response = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Gagal menghapus file.");
      setData(body);
      setNotice(`${name} berhasil dihapus dari dashboard.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal menghapus file.");
    }
  };

  const navItems = [
    { id: "ringkasan", label: "Ringkasan", icon: ChartNoAxesCombined },
    { id: "tukang", label: "Analisis tukang", icon: HardHat },
    { id: "divisi", label: "Analisis divisi", icon: Layers3 },
    { id: "alat", label: "Analisis alat", icon: Package },
    { id: "transaksi", label: "Detail transaksi", icon: ClipboardList },
  ];
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(searched.length / perPage));

  return (
    <div className="app-shell">
      {mobileMenu && <button className="menu-backdrop" aria-label="Tutup navigasi" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-icon"><BarChart3 size={22} strokeWidth={2.4} /></div><div><strong>BUKU<span>PAKAI</span></strong><small>WORKSHOP INTELLIGENCE</small></div></div>
        <div className="sidebar-divider" />
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Navigasi dashboard" className="side-nav">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-item ${activeNav === id ? "nav-active" : ""}`} onClick={() => jump(id)}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{activeNav === id && <span className="nav-marker" />}</button>)}
        </nav>
        <div className="nav-caption nav-caption-bottom">MANAJEMEN DATA</div>
        <button type="button" className={`nav-item ${activeNav === "sumber" ? "nav-active" : ""}`} onClick={() => jump("sumber")}><FolderOpen size={18} strokeWidth={1.9} /><span>Sumber Excel</span><span className="nav-count">{data.sources.length}</span></button>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><span className="sidebar-help-icon"><Activity size={18} /></span><strong>Data yang jelas,<br />keputusan yang tepat.</strong><p>Dari baris Excel sampai gambaran utuh biaya pemakaian.</p></div>
        <div className="sidebar-footer"><span className="status-dot" /> Berjalan di komputer lokal</div>
      </aside>

      <main className="main" id="main">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu icon-button" type="button" aria-label="Buka navigasi" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><span className="breadcrumb">Workspace</span><ChevronRight size={14} /><strong>Dashboard pemakaian</strong></div>
          <div className="topbar-right"><div className="live-indicator"><span className="live-dot" />DATA LOKAL</div><span className="topbar-separator" /><span className="topbar-date"><CalendarDays size={15} /> {month ? monthLabel(month) : "Pilih bulan"}</span></div>
        </header>
        <div className="content">
          {error && <div role="alert" className="alert alert-error"><CircleAlert size={17} />{error}<button type="button" aria-label="Tutup pesan" onClick={() => setError("")}><X size={16} /></button></div>}
          {notice && <div role="status" className="alert alert-success"><Check size={17} />{notice}<button type="button" aria-label="Tutup pesan" onClick={() => setNotice("")}><X size={16} /></button></div>}
          <section id="ringkasan" className="section-anchor">
            <div className="page-heading">
              <div><div className="page-kicker"><span className="kicker-line" /> OPERASIONAL / PEMAKAIAN ALAT</div><h1>Gambaran pemakaian<span className="title-period">.</span></h1><p>Pantau alat yang digunakan, siapa yang memakai, dan berapa biaya yang dikeluarkan.</p></div>
              <button type="button" className="button button-primary heading-action" onClick={() => jump("sumber")}>{isStatic ? <FolderOpen size={18} /> : <Plus size={18} />}{isStatic ? "Lihat sumber data" : "Tambah data Excel"}</button>
            </div>
            <div className="filter-bar">
              <div className="filter-intro"><SlidersHorizontal size={17} /><span>Filter laporan</span></div>
              <label className="filter-field"><span>Bulan</span><select aria-label="Pilih bulan" value={month} onChange={(event) => { setMonth(event.target.value); resetFilters(); }}><option value="" disabled>Pilih bulan</option>{months.map((item) => <option value={item} key={item}>{monthLabel(item)}</option>)}</select><ChevronDown size={14} /></label>
              <label className="filter-field"><span>Divisi</span><select aria-label="Pilih divisi" value={division} onChange={(event) => { setDivision(event.target.value); setWorker(""); }}><option value="">Semua divisi</option>{divisionOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
              <label className="filter-field"><span>Tukang</span><select aria-label="Pilih tukang" value={worker} onChange={(event) => setWorker(event.target.value)}><option value="">Semua tukang</option>{workerOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
              <button type="button" className="filter-reset" onClick={resetFilters} disabled={!division && !worker && !from && !to && !search}>Reset filter</button>
            </div>

            <div className="period-strip"><div><span className="period-icon"><CalendarDays size={17} /></span><strong>{month ? monthLabel(month) : "Belum ada periode"}</strong><span className="period-hint">Laporan penggunaan alat</span></div><span className="period-detail">{integer(filtered.length)} baris pemakaian tercatat <ArrowUpRight size={15} /></span></div>

            <div className="kpi-grid">
              <article className="kpi-card kpi-feature"><div className="kpi-top"><span>Total biaya pemakaian</span><span className="kpi-icon"><Wallet size={19} /></span></div><strong className="kpi-value kpi-value-money">{money(totalCost)}</strong><div className="kpi-bottom"><span className="mini-line" /><span>Akumulasi biaya periode terpilih</span></div></article>
              <article className="kpi-card"><div className="kpi-top"><span>Alat terpakai</span><span className="kpi-icon"><Package size={19} /></span></div><strong className="kpi-value">{integer(totalQty)}<small>unit</small></strong><div className="kpi-bottom"><span className="mini-square" />{integer(tools.length)} jenis alat berbeda</div></article>
              <article className="kpi-card"><div className="kpi-top"><span>Tukang aktif</span><span className="kpi-icon"><Users size={19} /></span></div><strong className="kpi-value">{integer(people.length)}<small>orang</small></strong><div className="kpi-bottom"><span className="mini-square" />Dari {integer(divisions.length)} divisi</div></article>
              <article className="kpi-card"><div className="kpi-top"><span>Dokumen usage</span><span className="kpi-icon"><ClipboardList size={19} /></span></div><strong className="kpi-value">{integer(usageCount)}<small>kode</small></strong><div className="kpi-bottom"><span className="mini-square" />{integer(filtered.length)} detail per alat</div></article>
            </div>

            {(missingPrice > 0 || missingDivision > 0) && <div className="data-warning"><CircleAlert size={18} /><div><strong>Perlu perhatian pada data</strong><span>{missingPrice > 0 ? `${integer(missingPrice)} baris belum memiliki harga alat; biayanya dihitung Rp 0. ` : ""}{missingDivision > 0 ? `${integer(missingDivision)} baris belum cocok dengan daftar divisi tukang.` : ""}</span></div></div>}

            <div className="chart-grid">
              <article className="panel trend-panel"><div className="panel-heading"><div><h2>Ritme pengeluaran</h2><p>Pergerakan biaya pemakaian sepanjang bulan</p></div><span className="panel-badge"><span /> BIAYA HARIAN</span></div><div className="trend-total">{shortMoney(totalCost)} <span>total periode</span></div><div className="chart-wrap trend-chart">{filtered.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={daily} margin={{ top: 12, right: 5, left: -26, bottom: 0 }}><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4B67D8" stopOpacity={0.18} /><stop offset="100%" stopColor="#4B67D8" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f0" strokeDasharray="3 5" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#89959B", fontSize: 11 }} interval={Math.max(1, Math.floor(daily.length / 6))} dy={9} /><YAxis axisLine={false} tickLine={false} tickFormatter={shortMoney} tick={{ fill: "#89959B", fontSize: 10 }} width={69} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="cost" stroke="#4B67D8" strokeWidth={2.7} fill="url(#chartFill)" activeDot={{ r: 5, fill: "#3557D7", stroke: "#fff", strokeWidth: 3 }} /></AreaChart></ResponsiveContainer> : <EmptyChart />}</div></article>
              <article className="panel division-chart-panel"><div className="panel-heading"><div><h2>Biaya per divisi</h2><p>Kontribusi biaya berdasarkan divisi</p></div><span className="panel-icon"><Layers3 size={19} /></span></div><div className="division-chart-list">{divisions.length ? divisions.slice(0, 5).map((item, index) => <button type="button" key={item.name} className="division-chart-row" onClick={() => focusDivision(item.name)}><span className="division-chart-head"><span className="division-chart-name"><i style={{ background: ["#4B67D8", "#8999DA", "#D6A36B", "#7B9A9E", "#A7B7AC"][index] }} />{item.name}</span><strong>{shortMoney(item.cost)}</strong></span><span className="division-chart-track"><span style={{ width: `${Math.max(2, totalCost ? item.cost / totalCost * 100 : item.qty / (totalQty || 1) * 100)}%`, background: ["#4B67D8", "#8999DA", "#D6A36B", "#7B9A9E", "#A7B7AC"][index] }} /></span></button>) : <EmptyChart />}</div><button type="button" className="text-link chart-footer-link" onClick={() => jump("divisi")}>Lihat semua divisi <ArrowRight size={16} /></button></article>
            </div>
          </section>

          <section id="tukang" className="section-anchor section-block">
            <div className="section-heading"><div><span className="section-label">01 / ANALISIS TUKANG</span><h2>Siapa memakai berapa?</h2><p>Urutan berdasarkan total biaya, dari yang terbesar.</p></div><span className="section-count">{integer(people.length)} TUKANG</span></div>
            <div className="people-grid">
              <article className="panel leader-panel">
                <div className="panel-heading"><div><h3>Pengeluaran tertinggi</h3><p>Tukang dengan total cost terbesar</p></div><span className="leader-icon"><ArrowUpRight size={22} /></span></div>
                {people.length ? <><div className="leader-name">{people[0].name}</div><div className="leader-division">{people[0].division}</div><div className="leader-metrics"><div><span>Total biaya</span><strong>{money(people[0].cost)}</strong></div><div><span>Alat terpakai</span><strong>{integer(people[0].qty)} <small>unit</small></strong></div></div><button type="button" className="leader-link" onClick={() => focusWorker(people[0].name)}>Lihat detail pemakaian <ArrowUpRight size={17} /></button></> : <EmptyChart />}
              </article>
              <article className="panel rank-panel"><div className="panel-heading"><div><h3>Peringkat tukang</h3><p>5 tukang dengan biaya pemakaian teratas</p></div><span className="panel-icon"><HardHat size={18} /></span></div><div className="rank-list">{people.length ? people.slice(0, 5).map((item, index) => <button className="rank-row" type="button" key={item.name} onClick={() => focusWorker(item.name)}><span className="rank-position">{String(index + 1).padStart(2, "0")}</span><span className="rank-info"><strong>{item.name}</strong><small>{item.division}</small></span><span className="rank-amount"><strong>{shortMoney(item.cost)}</strong><small>{integer(item.qty)} unit</small></span></button>) : <EmptyChart />}</div></article>
            </div>
            <div className="panel table-panel"><div className="panel-heading table-heading"><div><h3>Ringkasan seluruh tukang</h3><p>Klik nama untuk melihat transaksi per alat</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>NO.</th><th>NAMA TUKANG</th><th>DIVISI</th><th className="numeric">JENIS ALAT</th><th className="numeric">QTY</th><th className="numeric">TOTAL BIAYA</th><th /></tr></thead><tbody>{people.map((item, index) => <tr key={item.name} onClick={() => focusWorker(item.name)} className="clickable-row"><td className="muted-cell">{String(index + 1).padStart(2, "0")}</td><td className="name-cell">{item.name}</td><td><span className="division-tag">{item.division}</span></td><td className="numeric">{integer(item.tools.size)}</td><td className="numeric">{integer(item.qty)}</td><td className="numeric strong-cell">{money(item.cost)}</td><td className="arrow-cell"><ArrowUpRight size={16} /></td></tr>)}</tbody></table>{!people.length && <EmptyTable />}</div></div>
          </section>

          <section id="divisi" className="section-anchor section-block">
            <div className="section-heading"><div><span className="section-label">02 / ANALISIS DIVISI</span><h2>Biaya di tiap divisi.</h2><p>Jumlah alat, daftar alat yang dipakai, dan total biaya divisi.</p></div><span className="section-count">{integer(divisions.length)} DIVISI</span></div>
            <div className="panel table-panel"><div className="panel-heading table-heading"><div><h3>Rincian per divisi</h3><p>Klik satu divisi untuk membuka daftar alat yang digunakan</p></div><span className="panel-icon"><Layers3 size={19} /></span></div><div className="table-scroll"><table className="data-table division-table"><thead><tr><th>DIVISI</th><th className="numeric">TUKANG</th><th className="numeric">JENIS ALAT</th><th className="numeric">TOTAL QTY</th><th className="numeric">TOTAL BIAYA</th><th /></tr></thead><tbody>{divisions.map((item) => {
              const divisionEntries = filtered.filter((entry) => entry.division === item.name);
              const divisionTools = groupTools(divisionEntries);
              const isOpen = expandedDivision === item.name;
              return <FragmentDivision key={item.name} item={item} workers={new Set(divisionEntries.map((entry) => entry.worker)).size} tools={divisionTools} open={isOpen} onToggle={() => setExpandedDivision(isOpen ? "" : item.name)} onFilter={() => focusDivision(item.name)} />;
            })}</tbody></table>{!divisions.length && <EmptyTable />}</div></div>
          </section>

          <section id="alat" className="section-anchor section-block">
            <div className="section-heading"><div><span className="section-label">03 / ANALISIS ALAT</span><h2>Alat yang paling banyak dipakai.</h2><p>Temukan alat yang paling sering digunakan atau paling besar biayanya.</p></div><div className="segmented" role="group" aria-label="Urutkan alat"><button type="button" className={toolSort === "cost" ? "selected" : ""} onClick={() => setToolSort("cost")}>Biaya</button><button type="button" className={toolSort === "qty" ? "selected" : ""} onClick={() => setToolSort("qty")}>Quantity</button></div></div>
            <div className="tool-grid"><article className="panel tool-chart-panel"><div className="panel-heading"><div><h3>{toolSort === "cost" ? "Alat dengan biaya tertinggi" : "Alat paling banyak dipakai"}</h3><p>5 teratas berdasarkan {toolSort === "cost" ? "total biaya" : "total quantity"}</p></div><span className="panel-icon"><Package size={19} /></span></div><div className="tool-chart">{tools.length ? <ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={[...tools].sort((a, b) => b[toolSort] - a[toolSort]).slice(0, 5).map((item) => ({ ...item, label: item.name.length > 18 ? item.name.slice(0, 18) + "…" : item.name }))} margin={{ top: 4, left: 0, right: 20, bottom: 0 }}><CartesianGrid horizontal={false} stroke="#eef0f0" /><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value: number) => toolSort === "cost" ? shortMoney(value) : integer(value)} tick={{ fill: "#89959B", fontSize: 10 }} /><YAxis dataKey="label" type="category" axisLine={false} tickLine={false} width={145} tick={{ fill: "#45545A", fontSize: 11 }} /><Tooltip content={<ChartTooltip unit={toolSort} />} /><Bar dataKey={toolSort} radius={[0, 5, 5, 0]} barSize={16}>{tools.slice(0, 5).map((_, index) => <Cell key={index} fill={index === 0 ? "#3557D7" : "#A7B5ED"} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyChart />}</div></article><article className="panel tool-list-panel"><div className="panel-heading"><div><h3>Daftar alat</h3><p>{integer(tools.length)} jenis alat digunakan bulan ini</p></div></div><div className="top-tools-list">{[...tools].sort((a, b) => b[toolSort] - a[toolSort]).slice(0, 6).map((item, index) => <div key={item.code} className="top-tool-row"><span className="top-tool-index">{String(index + 1).padStart(2, "0")}</span><span className="top-tool-info"><strong>{item.name}</strong><small>{item.code} <span>·</span> {item.unit || "—"}</small></span><span className="top-tool-values"><strong>{integer(item.qty)} {item.unit}</strong><small>{shortMoney(item.cost)}</small></span></div>)}{!tools.length && <EmptyChart />}</div></article></div>
          </section>

          <section id="transaksi" className="section-anchor section-block">
            <div className="section-heading"><div><span className="section-label">04 / JEJAK TRANSAKSI</span><h2>Setiap baris, tercatat.</h2><p>Detail pemakaian per alat, lengkap dengan tanggal, kode usage, dan admin.</p></div><button type="button" className="button button-outline" onClick={() => exportCsv(searched, month)} disabled={!searched.length}><Download size={16} /> Ekspor CSV</button></div>
            <div className="panel transaction-panel"><div className="transaction-toolbar"><div className="search-field"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari tukang, alat, kode usage, admin..." aria-label="Cari transaksi" />{search && <button type="button" aria-label="Hapus pencarian" onClick={() => setSearch("")}><X size={15} /></button>}</div><div className="date-filters"><label>Dari <input type="date" aria-label="Tanggal mulai" value={from} min={month ? `${month}-01` : undefined} max={month ? `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}` : undefined} onChange={(event) => setFrom(event.target.value)} /></label><label>Sampai <input type="date" aria-label="Tanggal akhir" value={to} min={month ? `${month}-01` : undefined} max={month ? `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}` : undefined} onChange={(event) => setTo(event.target.value)} /></label></div></div>
              <div className="table-scroll"><table className="data-table transaction-table"><thead><tr><th>TANGGAL / JAM</th><th>KODE USAGE</th><th>TUKANG / DIVISI</th><th>ADMIN INPUT</th><th>ALAT / KODE</th><th>SATUAN</th><th className="numeric">QTY</th><th className="numeric">HARGA SATUAN</th><th className="numeric">TOTAL HARGA</th></tr></thead><tbody>{searched.slice((page - 1) * perPage, page * perPage).map((item) => <tr key={item.id}><td><strong className="date-main">{dateLabel(item.date)}</strong><span className="sub-cell">{item.date.slice(11, 16) || "—"}</span></td><td><span className="code-pill" title={item.note}>{usageCode(item.note)}</span></td><td><strong className="table-primary">{item.worker}</strong><span className="sub-cell truncate-cell" title={item.division}>{item.division}</span></td><td className="admin-cell">{item.admin || "—"}</td><td><strong className="table-primary tool-name-cell" title={item.name}>{item.name}</strong><span className="sub-cell mono-cell">{item.code}</span></td><td><span className="unit-pill">{item.unit || "—"}</span></td><td className="numeric">{integer(item.qty)}</td><td className="numeric">{item.priceMissing ? <span className="missing-text">Belum ada</span> : money(item.price ?? 0)}</td><td className="numeric strong-cell">{money(item.cost)}</td></tr>)}</tbody></table>{!searched.length && <EmptyTable message={filtered.length ? "Tidak ada transaksi yang cocok dengan pencarian." : "Belum ada transaksi pada filter ini."} />}</div>
              <div className="table-pagination"><span>Menampilkan {searched.length ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, searched.length)} dari {integer(searched.length)} baris</span><div><button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} /></button><span>{page} / {totalPages}</span><button type="button" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={17} /></button></div></div>
            </div>
          </section>

          <section id="sumber" className="section-anchor section-block sources-section">
            <div className="section-heading"><div><span className="section-label">05 / SUMBER DATA</span><h2>Kelola file Excel.</h2><p>Tambahkan file sebanyak yang diperlukan. Data yang tumpang tindih tidak dihitung dua kali.</p></div><span className="section-count">{integer(data.sources.length)} FILE</span></div>
            <div className="source-grid">
              <div className="panel upload-panel">
                <div className="panel-heading"><div><h3>{isStatic ? "Pembaruan data online" : "Tambah data baru"}</h3><p>{isStatic ? "Data disiapkan dari Excel saat website dipublikasikan." : "Gabungkan data beberapa file dan beberapa bulan sekaligus."}</p></div><span className="panel-icon">{isStatic ? <FolderOpen size={19} /> : <UploadCloud size={19} />}</span></div>
                {isStatic ? <div className="dropzone static-source-info"><div className="dropzone-icon"><FileSpreadsheet size={25} /></div><strong>Data Excel sudah dipublikasikan</strong><span>Untuk memperbarui, unggah Excel terbaru ke repository lalu deploy ulang.</span><span className="dropzone-format">Upload langsung tersedia pada versi lokal</span></div> : <>
                  <input ref={fileInput} type="file" multiple accept=".xlsx" className="visually-hidden" aria-label="Pilih file Excel" onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); }} />
                  <div className={`dropzone ${dragging ? "dropzone-dragging" : ""}`} role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }}><div className="dropzone-icon"><UploadCloud size={25} /></div><strong>{uploading ? "Sedang membaca file..." : "Tarik file Excel ke sini"}</strong><span>atau klik untuk memilih banyak file sekaligus</span><span className="dropzone-format">Mendukung .xlsx · Maks. 50 MB per file</span></div>
                  <div className="upload-note"><CircleAlert size={15} /> Harga mengikuti katalog terakhir diunggah. File yang sama persis dilewati otomatis.</div>
                </>}
              </div>
              <div className="panel sources-panel"><div className="panel-heading"><div><h3>File yang terhubung</h3><p>{isStatic ? "Sumber data yang digunakan saat publikasi." : "Hapus file untuk mengeluarkan datanya dari laporan."}</p></div><span className="sources-count">{data.sources.length}</span></div><div className="source-list">{data.sources.length ? [...data.sources].reverse().map((source) => <div key={source.id} className="source-row"><span className="source-icon"><FileSpreadsheet size={21} /></span><div className="source-info"><strong title={source.name}>{source.name}</strong><small>{[source.usages && `${integer(source.usages)} pemakaian`, source.tools && `${integer(source.tools)} alat`, source.workers && `${integer(source.workers)} tukang`].filter(Boolean).join(" · ") || "Data kosong"}{source.sample ? " · Bawaan" : ""}</small></div>{!isStatic && <button className="source-delete" type="button" aria-label={`Hapus ${source.name}`} title="Hapus file" onClick={() => void removeFile(source.id, source.name)}><Trash2 size={17} /></button>}</div>) : <div className="source-empty">Belum ada file. Tambahkan Excel untuk memulai.</div>}</div></div>
            </div>
            <div className="source-footnote"><span><Check size={15} /> {integer(data.toolCount)} kode alat terdaftar</span><span><Check size={15} /> {integer(data.workerCount)} tukang di daftar divisi</span><span><Check size={15} /> {integer(data.duplicateRows)} baris duplikat antarfile dilewati</span></div>
          </section>
          <footer className="footer"><div className="footer-brand"><span className="footer-symbol">▦</span> BUKUPAKAI</div><span>Alat tercatat. Biaya terbaca.</span><span>Dashboard lokal · {new Date().getFullYear()}</span></footer>
        </div>
      </main>
      {loading && <div className="loading-overlay"><div className="loading-spin" /> Membaca data Excel...</div>}
    </div>
  );
}

function FragmentDivision({ item, workers, tools, open, onToggle, onFilter }: {
  item: Summary; workers: number; tools: ToolSummary[]; open: boolean; onToggle: () => void; onFilter: () => void;
}) {
  return <><tr className={`clickable-row division-parent ${open ? "division-open" : ""}`} onClick={onToggle}><td><span className="division-name"><span className="division-initial">{item.name.slice(0, 1)}</span><strong>{item.name}</strong></span></td><td className="numeric">{integer(workers)}</td><td className="numeric">{integer(item.tools.size)}</td><td className="numeric">{integer(item.qty)}</td><td className="numeric strong-cell">{money(item.cost)}</td><td className="arrow-cell"><ChevronDown size={16} className={open ? "rotated" : ""} /></td></tr>{open && <tr className="division-detail-row"><td colSpan={6}><div className="division-details"><div className="division-details-head"><strong>Alat yang digunakan divisi ini</strong><button type="button" onClick={onFilter}>Lihat transaksi divisi <ArrowUpRight size={14} /></button></div><div className="division-tools">{tools.map((tool) => <div key={tool.code} className="division-tool"><span><strong>{tool.name}</strong><small>{tool.code} · {tool.unit || "—"}</small></span><span>{integer(tool.qty)} {tool.unit}</span><strong>{money(tool.cost)}</strong></div>)}</div></div></td></tr>}</>;
}

function EmptyChart() { return <div className="empty-chart"><BarChart3 size={28} strokeWidth={1.5} /><span>Belum ada data untuk ditampilkan.</span></div>; }
function EmptyTable({ message = "Belum ada data pada periode ini." }: { message?: string }) { return <div className="empty-table"><Package size={24} strokeWidth={1.5} /><strong>{message}</strong><span>Coba ubah filter atau tambahkan file Excel baru.</span></div>; }
