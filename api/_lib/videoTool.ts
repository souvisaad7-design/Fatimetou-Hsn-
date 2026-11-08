/**
 * أداة جاهزة لنموذج ذكاء اصطناعي (عند إضافة Backend بنموذج لغوي للمساعد).
 * يستدعيها النموذج عندما يكون السؤال عن نشاط أو حملة أو حدث للجمعية،
 * ثم يُرسل الخادم النتائج إلى الواجهة في الحقل videos من الرد.
 */
import { searchVideos, type VideoSearchResult } from "./supabase";

export const searchAssociationVideosTool = {
  name: "search_association_videos",
  description:
    "يبحث في فيديوهات قناة جمعية عون وسند الخيرية على يوتيوب. استعمله عندما يسأل المستخدم عن نشاط أو حملة أو حدث أو مشروع للجمعية (مثل السقايات، حفل التخريج، السلات الغذائية، كسوة العيد، التبرع بالدم، دروس المحجة البيضاء). يرجع حتى 3 فيديوهات.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "كلمات البحث بالعربية أو الفرنسية، مثل: حفل تخريج المعهد" },
    },
    required: ["query"],
  },
} as const;

export async function runSearchAssociationVideos(input: { query: string }): Promise<VideoSearchResult[]> {
  return searchVideos(String(input.query ?? "").slice(0, 200), 3);
}
