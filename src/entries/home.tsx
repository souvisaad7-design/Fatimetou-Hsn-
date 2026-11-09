/** بوابة المنتسبين للجنة الانتساب: التسجيل، متابعة الوضعية والانتساب، والتبرع للحملات */
import { mount } from "../app/bootstrap";
import PortalApp from "../features/membership/portal/PortalApp";
import { initLang } from "../features/membership/i18n";

// الروابط القديمة للمساعد (#/assistant) نحوّلها إلى عنوانه المستقل
if (window.location.hash.startsWith("#/assistant")) {
  const query = window.location.hash.split("?")[1];
  window.location.replace(`./assistant/${query ? `?${query}` : ""}`);
} else {
  initLang();
  mount(<PortalApp />);
}
