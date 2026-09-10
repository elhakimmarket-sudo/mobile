import axios from 'axios';
import { getToken } from './secureToken';

// ⚠️ غيّر ده لو عنوان السيرفر بتاعك اتغير
const BASE_URL = 'https://api.elhakimhr.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000 // 60 ثانية - السيرفر الجديد بياخد وقت أطول (رفع صورة + حساب راتب)، الـ15 ثانية القديمة كانت قليلة
});

// إضافة التوكن تلقائيًا لكل الطلبات
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// الخروج الإجباري
//
// المشكلة اللي بيحلها: لما الأدمن يوقف موظف، السيرفر بيرفض كل طلباته فعلًا، بس التطبيق
// كان بيفضل مفتوح عنده لأن بيانات الدخول متخزّنة على الجهاز ومحدش بيمسحها. النتيجة إن
// الموظف الموقوف كان لسه بيقدر يفتح التطبيق ويتفرّج على بياناته القديمة.
//
// الحل: أول ما السيرفر يقول إن الحساب متوقف أو التوكن مبقاش صالح، نمسح الجلسة من الجهاز
// ونرجّعه لشاشة تسجيل الدخول.
//
// ⚠️ بنعتمد على الـ code مش على رقم الحالة لوحده. 403 لوحدها مش كافية لأن السيرفر
// بيرجّعها كمان لما المورد يكون للأدمن بس - ولو خرّجنا الموظف في الحالة دي هيبقى غلط.
// الأكواد دي متعرّفة في backend/middleware/auth.js.
// ---------------------------------------------------------------------------
const FORCED_LOGOUT_CODES = ['ACCOUNT_INACTIVE', 'TOKEN_INVALID'];

let onForcedLogout = null;

// بيسجّلها AuthContext مرة واحدة عند فتح التطبيق
export const setForcedLogoutHandler = (fn) => {
  onForcedLogout = fn;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const code = error?.response?.data?.code;

    // من غير response أصلًا يبقى ده عطل شبكة أو timeout - مش سبب لتسجيل الخروج.
    // ده بيحصل كتير جوه المخازن والأماكن اللي الشبكة فيها ضعيفة، ولو خرّجنا الموظف
    // في الحالة دي هنقفل التطبيق في وش ناس حساباتها شغالة عادي.
    if (error?.response && (status === 401 || status === 403) && FORCED_LOGOUT_CODES.includes(code)) {
      if (onForcedLogout) {
        try {
          await onForcedLogout(code);
        } catch (e) {
          // لو فشل مسح الجلسة لأي سبب، منوقعش الطلب الأصلي بسببه
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { BASE_URL };
