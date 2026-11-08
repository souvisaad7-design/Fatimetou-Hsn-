import { useCallback, useEffect, useState } from "react";
import { storage } from "./storage";

type Theme = "light" | "dark";
const KEY = "awn:theme";

const systemTheme = (): Theme => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** الوضع الفاتح/الداكن: يتبع إعداد الجهاز ما لم يختر المستخدم وضعاً بنفسه */
export function useTheme() {
  const [chosen, setChosen] = useState<Theme | null>(() => storage.get<Theme>(KEY));
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(systemTheme());
    mq?.addEventListener("change", onChange);
    return () => mq?.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (chosen) document.documentElement.dataset.theme = chosen;
    else delete document.documentElement.dataset.theme;
  }, [chosen]);

  const theme = chosen ?? system;
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setChosen(next);
    storage.set(KEY, next);
  }, [theme]);

  return { theme, toggle };
}
