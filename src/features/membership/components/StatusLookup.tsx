import { useEffect, useState, type FormEvent } from "react";
import { applicationStages } from "../data";
import { lookupApplication, SAMPLE_REF, type ApplicationStatus } from "../services/membershipService";

/** الاستعلام عن حالة طلب انتساب برقم الطلب */
export function StatusLookup({ query }: { query: { ref: string; nonce: number } | null }) {
  const [value, setValue] = useState(SAMPLE_REF);
  const [result, setResult] = useState<ApplicationStatus | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function search(ref: string) {
    setLoading(true);
    setResult(await lookupApplication(ref));
    setLoading(false);
  }

  useEffect(() => {
    void search(SAMPLE_REF);
  }, []);

  // عند الضغط على "متابعة هذا الطلب" بعد الإرسال
  useEffect(() => {
    if (!query) return;
    setValue(query.ref);
    void search(query.ref);
  }, [query]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void search(value);
  };

  return (
    <div className="status-box">
      <div>
        <span className="eyebrow">متابعة الطلب</span>
        <h2>أين وصل طلب انتسابك؟</h2>
        <p>أدخل رقم الطلب الذي ظهر لك بعد الإرسال. جرّب الرقم التجريبي <span dir="ltr">{SAMPLE_REF}</span>.</p>
        <form className="status-form" onSubmit={onSubmit}>
          <input id="status-ref" aria-label="رقم الطلب" placeholder="INT-2026-00000" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn" type="submit" disabled={loading}>{loading ? "جارٍ البحث..." : "استعلام"}</button>
        </form>
      </div>
      <div className="result" aria-live="polite">
        {result === null && (
          <>
            <h3>لم نجد هذا الرقم</h3>
            <p className="muted">تأكد من كتابة الرقم بالصيغة INT-2026-00000، أو اتصل بالرقم الأخضر.</p>
          </>
        )}
        {result && (
          <>
            <h3>{result.name}</h3>
            <p className="muted">{result.wilaya} · رقم الطلب {result.ref}</p>
            <ol className="timeline">
              {applicationStages.map((s, i) => (
                <li key={s.title} className={i < result.stage ? "done" : i === result.stage ? "now" : undefined}>
                  <div>
                    <strong>{s.title}{i === result.stage && " — قيد المعالجة"}</strong>
                    <small>{s.detail}</small>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
