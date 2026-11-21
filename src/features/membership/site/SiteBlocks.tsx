/** عرض محتوى «إدارة الموقع» في بوابة المنتسبين: الإعلانات، روابط الصفحات، والصفحة نفسها */
import { Icon } from "../../../shared/Icon";
import { t, useLang } from "../i18n";
import { renderRichText, safeUrl, useSite, type SitePage } from "./siteApi";
import "./site.css";

const pageTitle = (p: SitePage, lang: string) => (lang === "fr" && p.title_fr ? p.title_fr : p.title_ar);

export function Announcements() {
  const { posts } = useSite();
  if (!posts.length) return null;
  return (
    <section aria-label={t("site.news")}>
      <h2 className="pt-h2">📢 {t("site.news")}</h2>
      <div className="st-posts">
        {posts.slice(0, 6).map((p) => (
          <article key={p.id} className={`st-post${p.pinned ? " is-pinned" : ""}`}>
            {safeUrl(p.image_url) && <img src={safeUrl(p.image_url)} alt="" loading="lazy" />}
            <div className="st-post__body">
              <div className="st-post__meta">
                {p.pinned && <span className="st-pin">📌 {t("site.pinned")}</span>}
                <time className="num">{new Date(p.created_at).toLocaleDateString("fr-FR")}</time>
              </div>
              <h3>{p.title}</h3>
              {p.body && <div className="st-rich" dangerouslySetInnerHTML={{ __html: renderRichText(p.body) }} />}
              {safeUrl(p.link_url) && <a className="pt-link" href={safeUrl(p.link_url)} target="_blank" rel="noopener noreferrer">{t("site.more")} ←</a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PageLinks() {
  const { pages } = useSite();
  const { lang } = useLang();
  if (!pages.length) return null;
  return (
    <section aria-label={t("site.pages")}>
      <h2 className="pt-h2">{t("site.pages")}</h2>
      <div className="st-pagelinks">
        {pages.map((p) => (
          <a key={p.id} href={`#/p/${p.slug}`} className="st-pagelink"><Icon name="list" size={18} /> {pageTitle(p, lang)}</a>
        ))}
      </div>
    </section>
  );
}

export function SitePageView({ slug }: { slug: string }) {
  const { pages, loaded } = useSite();
  const { lang } = useLang();
  const page = pages.find((p) => p.slug === slug);
  if (!loaded) return <div className="app-message" aria-busy="true"><span className="app-spinner" aria-hidden="true" /></div>;
  if (!page) return <section className="lv-empty"><h2>{t("site.notFound")}</h2><a className="pt-link" href="#/home">{t("nav.home")} ←</a></section>;
  const body = lang === "fr" && page.body_fr ? page.body_fr : page.body_ar;
  return (
    <article className="pt-stack st-page">
      <h1 className="pt-h1">{pageTitle(page, lang)}</h1>
      <div className="st-rich" dangerouslySetInnerHTML={{ __html: renderRichText(body) }} />
    </article>
  );
}

/** صورة كبيرة أعلى الصفحة الرئيسية (تضعها اللجنة من «إدارة الموقع») */
export function HomeBanner() {
  const { settings } = useSite();
  const b = settings.banner;
  const img = safeUrl(b?.image_url), link = safeUrl(b?.link);
  if (!b || !img || (settings.hidden ?? []).includes("home.banner")) return null;
  const inner = (
    <>
      <img src={img} alt={b.title ?? ""} />
      {b.title && <span className="st-banner__title">{b.title}</span>}
    </>
  );
  return link
    ? <a className="st-banner" href={link} target={link.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer">{inner}</a>
    : <div className="st-banner">{inner}</div>;
}
