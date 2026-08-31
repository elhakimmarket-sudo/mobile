// طبقة تخزين مؤقت بسيطة فوق api.
//
// المشكلة اللي بتحلها: كل شاشة في التطبيق بتنادي السيرفر من الأول كل مرة تتفتح
// (useFocusEffect)، فالموظف بيستنى دايرة تحميل على بيانات هو شافها من ثواني.
// وكمان لو النت فاصل، الشاشة بتفضل فاضية خالص.
//
// الفكرة: كل رد بيتحفظ على الجهاز. المرة الجاية بنرجّع المحفوظ فورًا (من غير أي انتظار)
// وفي نفس الوقت بنسأل السيرفر في الخلفية ونحدّث لما يرد. لو النت فاصل، المحفوظ بيفضل معروض.

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PREFIX = 'cache:';

export async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch (e) {
    return null; // كاش بايظ ميوقفش الشاشة
  }
}

export async function writeCache(key, data) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch (e) {
    // امتلاء التخزين مثلًا - مش مشكلة، الشاشة هتشتغل من الشبكة عادي
  }
}

/**
 * بترجع { cached, fresh }:
 *   cached — آخر نسخة محفوظة (أو null لو أول مرة). متاحة فورًا.
 *   fresh  — وعد بالبيانات الجديدة من السيرفر. بيرمي خطأ لو النت فاصل.
 *
 * الاستخدام المقصود في الشاشة:
 *   const { cached, fresh } = await cachedGet('salary', '/salary/my');
 *   if (cached) { setData(cached.data); setLoading(false); }
 *   try { setData(await fresh); } catch { setOffline(true); }
 */
export async function cachedGet(key, url, config) {
  const cached = await readCache(key);

  const fresh = api.get(url, config).then(async (res) => {
    await writeCache(key, res.data);
    return res.data;
  });

  // من غير الـ catch دي، لو الشاشة معملتش await للوعد ده بيبقى unhandled rejection
  fresh.catch(() => {});

  return { cached, fresh };
}

// بتمسح كل الكاش - بتتنادى وقت تسجيل الخروج عشان مايشوفش الموظف الجديد بيانات اللي قبله
export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch (e) {}
}
