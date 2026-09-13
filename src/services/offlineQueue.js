// طابور تسجيل الحضور/الانصراف وقت انقطاع النت.
//
// القاعدة اللي اتفقنا عليها: التسجيل بدون نت مسموح **بس** لو الموظف جوه نطاق المكتب
// وقت التسجيل. اللي عايز يزوّر وقت جهازه غالبًا مش قاعد في المكتب، فده بيقفل معظم
// حالات التلاعب. وأي سجل بيتبعت من الطابور بيتعلّم على السيرفر (recordedOffline)
// وبيظهر بعلامة مميزة في لوحة الأدمن للمراجعة.
//
// الصورة بتتخزن كملف على الجهاز (مش base64 في AsyncStorage) عشان متملاش التخزين.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import api from './api';
import { readCache, writeCache } from './cache';

const QUEUE_KEY = 'offlineQueue:attendance';
const OFFICE_KEY = 'officeConfig';
const QUEUE_DIR = FileSystem.documentDirectory + 'offline-attendance/';

// ---------- إعدادات المكتب ----------
// بتتحدث من السيرفر كل ما فيه نت، وبتتقرا من الجهاز وقت الانقطاع
export async function refreshOfficeConfig() {
  try {
    const { data } = await api.get('/attendance/office-config');
    await writeCache(OFFICE_KEY, data);
    return data;
  } catch (e) {
    const cached = await readCache(OFFICE_KEY);
    return cached?.data || null;
  }
}

export async function getOfficeConfig() {
  const cached = await readCache(OFFICE_KEY);
  return cached?.data || null;
}

// مسافة بين نقطتين بالمتر (هافرساين) - نفس حساب geolib اللي على السيرفر تقريبًا.
// محتاجينها هنا عشان نتحقق من النطاق والموبايل مقطوع من غير أي مكتبة زيادة
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// هل الموظف جوه النطاق؟ بترجع { allowed, distance, radius } - أو allowed:false
// لو مفيش إعدادات محفوظة أصلًا (يعني التطبيق لسه ماتصلش بالسيرفر ولا مرة)
export async function isInsideOffice(lat, lng) {
  const office = await getOfficeConfig();
  if (!office) return { allowed: false, reason: 'no_config' };
  const distance = distanceMeters({ lat, lng }, { lat: office.lat, lng: office.lng });
  return { allowed: distance <= office.radius, distance, radius: office.radius };
}

// ---------- الطابور ----------
async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function writeQueue(items) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {}
}

export async function queueLength() {
  return (await readQueue()).length;
}

/**
 * بتحط تسجيل حضور/انصراف في الطابور. بترفض لو الموظف برة النطاق.
 * kind: 'check-in' | 'check-out'
 * photoUri: مسار الصورة اللي الكاميرا رجّعته
 */
export async function enqueueAttendance({ kind, lat, lng, photoUri }) {
  const inside = await isInsideOffice(lat, lng);
  if (!inside.allowed) {
    if (inside.reason === 'no_config') {
      return { ok: false, message: 'مينفعش تسجل من غير نت قبل ما تفتح التطبيق متصل مرة واحدة على الأقل' };
    }
    return {
      ok: false,
      message: `مينفعش تسجل من غير نت وإنت برة نطاق المكتب (على بعد ${inside.distance} متر تقريبًا)`
    };
  }

  // ننسخ الصورة لمجلد دائم - ملفات الكاميرا المؤقتة بيمسحها النظام
  await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true }).catch(() => {});
  const savedPhoto = QUEUE_DIR + `${Date.now()}.jpg`;
  try {
    await FileSystem.copyAsync({ from: photoUri, to: savedPhoto });
  } catch (e) {
    return { ok: false, message: `تعذّر حفظ الصورة على الجهاز${e?.message ? `\n(${e.message})` : ''}` };
  }

  const items = await readQueue();
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    lat,
    lng,
    photoUri: savedPhoto,
    clientTime: new Date().toISOString(), // ده الوقت اللي السيرفر هيسجله
    attempts: 0
  });
  await writeQueue(items);

  return { ok: true, message: 'اتسجل على الجهاز - هيتبعت أول ما النت يرجع', queued: items.length };
}

/**
 * بتحاول تبعت كل اللي في الطابور بالترتيب. آمنة تتنادى كذا مرة.
 * بتقف عند أول فشل شبكة عشان تحافظ على ترتيب الحضور قبل الانصراف.
 */
export async function flushQueue() {
  let items = await readQueue();
  if (items.length === 0) return { sent: 0, failed: 0, remaining: 0 };

  let sent = 0;
  let failed = 0;

  while (items.length > 0) {
    const item = items[0];
    const form = new FormData();
    form.append('lat', String(item.lat));
    form.append('lng', String(item.lng));
    form.append('clientTime', item.clientTime);
    form.append('photo', { uri: item.photoUri, name: 'attendance.jpg', type: 'image/jpeg' });

    try {
      await api.post(`/attendance/${item.kind}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      sent += 1;
      await FileSystem.deleteAsync(item.photoUri, { idempotent: true }).catch(() => {});
      items.shift();
      await writeQueue(items);
    } catch (err) {
      const status = err?.response?.status;
      // رد من السيرفر برفض واضح (مسجل بالفعل، برة النطاق، الوقت قديم...) - مفيش فايدة من إعادة المحاولة
      if (status && status >= 400 && status < 500) {
        failed += 1;
        await FileSystem.deleteAsync(item.photoUri, { idempotent: true }).catch(() => {});
        items.shift();
        await writeQueue(items);
        continue;
      }
      // مشكلة شبكة - نسيبه مكانه ونوقف عشان الترتيب ميتلخبطش
      item.attempts = (item.attempts || 0) + 1;
      await writeQueue(items);
      break;
    }
  }

  return { sent, failed, remaining: items.length };
}
