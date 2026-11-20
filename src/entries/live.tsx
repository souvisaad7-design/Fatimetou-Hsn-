/** رابط البث المباشر المستقل: يشاهده أي شخص معه الرابط، دون رقم هاتف أو كلمة مرور (مشاهدة فقط) */
import { mount } from "../app/bootstrap";
import GuestLivePage from "../features/membership/live/GuestLivePage";
import { initLang } from "../features/membership/i18n";

initLang();
mount(<GuestLivePage />);
