/** الموقع الأول: الصفحة الرئيسية لجمعية عون وسند الخيرية (مستقل عن المساعد) */
import { mount } from "../app/bootstrap";
import HomePage from "../features/home/HomePage";

// الروابط القديمة للمساعد (#/assistant) كانت على هذا العنوان؛ نحوّلها إلى عنوانه المستقل الجديد
if (window.location.hash.startsWith("#/assistant")) {
  const query = window.location.hash.split("?")[1];
  window.location.replace(`./assistant/${query ? `?${query}` : ""}`);
} else {
  mount(<HomePage />);
}
