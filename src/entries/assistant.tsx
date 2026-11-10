/** الموقع الثاني: المساعد الذكي لجمعية عون وسند الخيرية (مستقل عن الصفحة الرئيسية) */
import { mount } from "../app/bootstrap";
import AssistantPage from "../features/assistant/AssistantPage";
import { initLang } from "../features/membership/i18n";

// اللغة نفسها المختارة في بوابة المنتسبين (العربية أو Français)
initLang();
mount(<AssistantPage />);
