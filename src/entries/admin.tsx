/** لوحة إدارة اللجنة الانتسابية */
import { mount } from "../app/bootstrap";
import AdminApp from "../features/membership/admin/AdminApp";
import { setLang } from "../features/membership/i18n";
import { loadSite } from "../features/membership/site/siteApi";

// لوحة الإدارة بالعربية دائماً
setLang("ar", { persist: false });
void loadSite();

mount(<AdminApp />);
