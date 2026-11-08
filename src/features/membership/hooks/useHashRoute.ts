import { useCallback, useEffect, useState } from "react";

/** تنقل بسيط بين صفحات الموقع عبر # في الرابط (يعمل على GitHub Pages) */
export function useHashRoute(defaultRoute: string) {
  const read = () => window.location.hash.replace(/^#\/?/, "") || defaultRoute;
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = useCallback((to: string) => {
    window.location.hash = `/${to}`;
  }, []);
  const [page, ...params] = route.split("/");
  return { page, params, go };
}
