/** لوحة إدارة اللجنة الانتسابية */
import { mount } from "../app/bootstrap";
import AdminApp from "../features/membership/admin/AdminApp";
import { setLang } from "../features/membership/i18n";

// لوحة الإدارة بالعربية دائماً
setLang("ar", { persist: false });

mount(<AdminApp />);
