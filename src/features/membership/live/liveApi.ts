/** البث المباشر الخاص باللجنة: قراءة البثوث والتعليقات وطلب إذن الدخول من الخادم */
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  status: "scheduled" | "live" | "ended";
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  peak_viewers: number;
  created_at: string;
}
export interface LiveComment {
  id: string;
  session_id: string;
  author_name: string;
  is_committee: boolean;
  body: string;
  hidden: boolean;
  created_at: string;
}

export async function fetchSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase.from("live_sessions")
    .select("id, title, description, status, scheduled_at, started_at, ended_at, peak_viewers, created_at")
    .order("created_at", { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []) as LiveSession[];
}

/** البث الجاري والبث القادم (يتحدّث تلقائياً كل 20 ثانية) */
export function useLiveStatus(intervalMs = 20000) {
  const [live, setLive] = useState<LiveSession | null>(null);
  const [next, setNext] = useState<LiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await supabase.from("live_sessions")
          .select("id, title, description, status, scheduled_at, started_at, ended_at, peak_viewers, created_at")
          .in("status", ["live", "scheduled"]).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(10);
        if (!alive) return;
        const rows = (data ?? []) as LiveSession[];
        setLive(rows.find((s) => s.status === "live") ?? null);
        setNext(rows.find((s) => s.status === "scheduled" && s.scheduled_at && new Date(s.scheduled_at).getTime() > Date.now() - 3 * 3600_000) ?? null);
      } catch { /* يُعاد في الدورة التالية */ }
      if (alive) setLoaded(true);
    };
    void load();
    const t = setInterval(load, intervalMs);
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [intervalMs]);
  return { live, next, loaded };
}

/** إذن الدخول إلى البث (يصدره الخادم بعد التحقق من الصلاحية) */
export async function getLiveToken(role: "publisher" | "viewer", sessionId?: string): Promise<{ url: string; token: string; session_id: string }> {
  const { data, error } = await supabase.functions.invoke("live-token", { body: { action: "token", role, session_id: sessionId } });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as { context?: Response }).context; const j = ctx ? await ctx.json() : null; if (j?.error) msg = j.error; } catch { /* */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function reportViewers(count: number) {
  void supabase.functions.invoke("live-token", { body: { action: "viewers", count } }).catch(() => {});
}
