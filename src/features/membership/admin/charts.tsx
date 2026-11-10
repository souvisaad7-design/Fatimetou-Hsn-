/**
 * رسوم لوحة الإدارة بـ Chart.js: نمو الأعضاء، الإحالات حسب المشرف، توزيع مبالغ الانتساب، والانتساب والتبرعات شهرياً.
 * الألوان تتبع الوضع الفاتح/الداكن وتتحدث تلقائياً عند تبديله، والخط Cairo، والاتجاه من اليمين لليسار.
 */
import { useEffect, useMemo, useRef } from "react";
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Filler, Legend,
  LineController, LineElement, LinearScale, PointElement, Tooltip, type ChartConfiguration,
} from "chart.js";
import { useTheme, type Theme } from "../../../shared/useTheme";
import type { Database } from "../types";
import { lastMonths, money, monthLabel } from "../lib/format";

Chart.register(ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend, LineController, LineElement, LinearScale, PointElement, Tooltip);

/** ألوان الرسوم لكل وضع (من هوية الجمعية: الكحلي والوردي) */
const PALETTE: Record<Theme, { ink: string; muted: string; grid: string; surface: string; series: string[] }> = {
  light: { ink: "#1d1a33", muted: "#6b6785", grid: "rgba(39,36,79,0.08)", surface: "#ffffff", series: ["#27244f", "#e8806c", "#2f9e6f", "#e3a54a", "#7c6fd6", "#3a8fd1"] },
  dark: { ink: "#eeebf7", muted: "#a9a4c4", grid: "rgba(238,235,247,0.09)", surface: "#201c3d", series: ["#9a93e0", "#f4aa9c", "#5cc58f", "#e3b35a", "#c3b8ff", "#6cb6ef"] },
};
/** عنوان الشهر في سطرين (الشهر ثم السنة) حتى لا يميل */
const twoLines = (m: string) => monthLabel(m).split(" ");
const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;

type Build = (p: (typeof PALETTE)["light"]) => ChartConfiguration;

/** لوحة رسم واحدة: تُعاد بناؤها عند تغيّر البيانات أو الوضع الفاتح/الداكن */
function ChartCanvas({ build, label, height = 260 }: { build: Build; label: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!ref.current) return;
    const p = PALETTE[theme];
    Chart.defaults.font.family = "Cairo, 'Segoe UI', Tahoma, sans-serif";
    Chart.defaults.color = p.muted;
    Chart.defaults.borderColor = p.grid;
    const cfg = buildRef.current(p);
    const chart = new Chart(ref.current, {
      ...cfg,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        locale: "fr-FR", // أرقام لاتينية (13578)
        animation: { duration: 500 },
        ...cfg.options,
        plugins: {
          legend: { rtl: true, position: "bottom", labels: { usePointStyle: true, boxWidth: 8, padding: 14, color: p.ink, font: { size: 12, weight: 600 } } },
          tooltip: { rtl: true, textDirection: "rtl", backgroundColor: p.ink, titleColor: p.surface, bodyColor: p.surface, padding: 10, cornerRadius: 10, titleFont: { weight: 700 } },
          ...cfg.options?.plugins,
        },
      },
    });
    return () => chart.destroy();
  }, [theme, build]);

  return (
    <div className="ad-chart" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

const axes = (p: (typeof PALETTE)["light"], stacked = false) => ({
  x: { reverse: true, stacked, grid: { display: false }, ticks: { color: p.muted, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } }, // من اليمين لليسار
  y: { position: "right" as const, stacked, beginAtZero: true, grid: { color: p.grid }, border: { display: false }, ticks: { color: p.muted, precision: 0 } },
});

/** نمو الأعضاء: التسجيلات الجديدة كل شهر، والمجموع التراكمي للمسجلين والمعتمدين */
export function GrowthChart({ db }: { db: Database }) {
  const build = useMemo<Build>(() => {
    const months = lastMonths(12);
    const ym = (iso: string) => iso.slice(0, 7);
    const before = (m: string) => db.members.filter((x) => ym(x.createdAt) <= m);
    const total = months.map((m) => before(m).length);
    const approved = months.map((m) => before(m).filter((x) => x.status === "approved").length);
    const fresh = months.map((m) => db.members.filter((x) => ym(x.createdAt) === m).length);
    return (p) => ({
      type: "bar",
      data: {
        labels: months.map(twoLines),
        datasets: [
          { type: "line", label: "إجمالي المسجلين", data: total, borderColor: p.series[0], backgroundColor: alpha(p.series[0], 0.12), fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2.5, order: 1 },
          { type: "line", label: "المعتمدون", data: approved, borderColor: p.series[2], backgroundColor: "transparent", tension: 0.35, pointRadius: 3, borderWidth: 2, borderDash: [5, 4], order: 2 },
          { type: "bar", label: "تسجيلات جديدة", data: fresh, backgroundColor: alpha(p.series[1], 0.85), borderRadius: 6, maxBarThickness: 22, order: 3 },
        ],
      },
      options: {
        scales: axes(p),
        interaction: { mode: "index", intersect: false },
        plugins: { tooltip: { callbacks: { title: (items) => monthLabel(months[items[0].dataIndex]) } } },
      },
    });
  }, [db.members]);
  return <ChartCanvas build={build} label="نمو الأعضاء في آخر 12 شهراً" height={280} />;
}

/** الإحالات: عدد المنتسبين المعتمدين في قائمة كل مشرف */
export function ReferralsChart({ db }: { db: Database }) {
  const build = useMemo<Build>(() => {
    const approved = db.members.filter((m) => m.status === "approved");
    const rows = db.lists
      .map((l) => ({ label: l.supervisor ? `${l.supervisor} — ${l.name}` : l.name, n: approved.filter((m) => m.listId === l.id).length }))
      .concat([{ label: "بدون قائمة", n: approved.filter((m) => !m.listId).length }])
      .filter((r) => r.n > 0 || db.lists.length < 8)
      .sort((a, b) => b.n - a.n);
    return (p) => ({
      type: "bar",
      data: {
        labels: rows.map((r) => r.label),
        datasets: [{ label: "المنتسبون", data: rows.map((r) => r.n), backgroundColor: rows.map((_, i) => alpha(p.series[i % p.series.length], 0.85)), borderRadius: 8, maxBarThickness: 26 }],
      },
      options: {
        indexAxis: "y",
        scales: {
          x: { reverse: true, beginAtZero: true, grid: { color: p.grid }, border: { display: false }, ticks: { color: p.muted, precision: 0 } },
          y: { position: "right", grid: { display: false }, ticks: { color: p.ink, font: { weight: 600 } } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }, [db.members, db.lists]);
  return <ChartCanvas build={build} label="عدد المنتسبين في قائمة كل مشرف" height={Math.max(220, 46 * (db.lists.length + 1))} />;
}

/** «الباقات»: توزيع المنتسبين حسب مبلغ الانتساب الشهري الذي اختاروه (أوقية قديمة) */
export const PLAN_BUCKETS = [
  { label: "حسب القدرة (بلا مبلغ)", test: (v?: number) => !v },
  { label: "أقل من 100", test: (v?: number) => !!v && v < 100 },
  { label: "100 – 499", test: (v?: number) => !!v && v >= 100 && v < 500 },
  { label: "500 – 999", test: (v?: number) => !!v && v >= 500 && v < 1000 },
  { label: "1000 – 4999", test: (v?: number) => !!v && v >= 1000 && v < 5000 },
  { label: "5000 فأكثر", test: (v?: number) => !!v && v >= 5000 },
];

export function PlansChart({ db }: { db: Database }) {
  const build = useMemo<Build>(() => {
    const approved = db.members.filter((m) => m.status === "approved");
    const counts = PLAN_BUCKETS.map((b) => approved.filter((m) => b.test(m.pledge)).length);
    return (p) => ({
      type: "doughnut",
      data: {
        labels: PLAN_BUCKETS.map((b) => b.label),
        datasets: [{ data: counts, backgroundColor: PLAN_BUCKETS.map((_, i) => p.series[i % p.series.length]), borderColor: p.surface, borderWidth: 3, hoverOffset: 8 }],
      },
      options: { cutout: "64%", plugins: { tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw} منتسب` } } } },
    });
  }, [db.members]);
  return <ChartCanvas build={build} label="توزيع المنتسبين حسب مبلغ الانتساب الشهري" height={280} />;
}

/** الانتساب الشهري والتبرعات المؤكدة في آخر 6 أشهر */
export function MoneyChart({ data }: { data: Array<{ month: string; membership: number; donations: number }> }) {
  const build = useMemo<Build>(() => (p) => ({
    type: "bar",
    data: {
      labels: data.map((d) => twoLines(d.month)),
      datasets: [
        { label: "الانتساب", data: data.map((d) => d.membership), backgroundColor: p.series[0], borderRadius: 6, maxBarThickness: 26 },
        { label: "التبرعات", data: data.map((d) => d.donations), backgroundColor: p.series[1], borderRadius: 6, maxBarThickness: 26 },
      ],
    },
    options: {
      scales: axes(p),
      interaction: { mode: "index", intersect: false },
      plugins: { tooltip: { callbacks: { title: (items) => monthLabel(data[items[0].dataIndex].month), label: (c) => ` ${c.dataset.label}: ${money(Number(c.raw))}` } } },
    },
  }), [data]);
  return <ChartCanvas build={build} label="الانتساب الشهري والتبرعات في آخر 6 أشهر" />;
}
