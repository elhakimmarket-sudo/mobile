// تنبيه "متنساش تسجيل الانصراف"
//
// ⚠️ التنبيهات دي **مبقتش مجدولة على الجهاز** - بقت بتتبعت من السيرفر
// (backend/utils/checkOutReminderScheduler.js).
//
// ليه اتغيّرت: الجدولة المحلية كانت بتشتغل على الأندرويد بس. أصحاب الآيفون بيستخدموا
// صفحة الويب، والمتصفح مبيقدرش يجدول تنبيه وهو مقفول - فنص الموظفين مكانش بيوصلهم
// حاجة. وكمان التنبيه المحلي كان بيضيع لو التطبيق اتشال أو التخزين اتنضّف.
//
// اللي فضل هنا: إعداد قناة أندرويد وأزرار التنبيه (لازم يتسجّلوا على الجهاز عشان
// الإشعار الجاي من السيرفر يعرض الأزرار)، والتعامل مع ضغطة الموظف على الأزرار.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import api from './api';

// ⚠️ قنوات أندرويد ثابتة بعد إنشائها - أي تعديل في إعدادات القناة محتاج ID جديد
const CHANNEL_ID = 'checkout-reminder-v2';

// ⚠️ لازم يطابق EXPO_CATEGORIES في backend/utils/pushNotifications.js.
// السيرفر بيبعت الـ ID ده مع الإشعار، والجهاز بيدوّر عليه عشان يعرض الأزرار.
const CATEGORY_ID = 'checkout-reminder-actions-v4';
const ACK_ACTION_ID = 'checkout-ack';
const OVERTIME_ACTION_ID = 'checkout-overtime';
const NOTIFICATION_TYPE = 'checkout-reminder';

export const setupCheckoutNotificationChannel = async () => {
  // ⚠️ الزرارين لازم يفتحوا التطبيق (opensAppToForeground: true).
  // السبب: أندرويد مش بيشغّل كود التطبيق لما التطبيق مقفول والزرار مش بيفتحه -
  // وساعتها ضغطة "لسه شغال" مكانتش هتوصل للسيرفر خالص.
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACK_ACTION_ID, buttonTitle: 'سجّل انصرافي', options: { opensAppToForeground: true } },
    { identifier: OVERTIME_ACTION_ID, buttonTitle: 'لسه شغال', options: { opensAppToForeground: true } }
  ]);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'تنبيه تسجيل الانصراف',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600],
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
    });
  }
};

// بتمسح أي تنبيهات انصراف سايبة في شريط الإشعارات.
// مبقاش فيه تنبيهات مجدولة نلغيها - السيرفر هو اللي بيقرر يبعت ولا لأ.
export const cancelCheckOutReminder = async () => {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => n.request?.content?.data?.type === NOTIFICATION_TYPE)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch (e) {
    // مش مهم لو فشل - التنبيهات هتختفي لوحدها لما المستخدم يمسحها
  }
};

const isCheckOutResponse = (response) =>
  response?.notification?.request?.content?.data?.type === NOTIFICATION_TYPE;

/**
 * بتتنادى مرة واحدة عند فتح التطبيق (من App.js) - مش من شاشة معيّنة.
 *
 * ليه: المستمع اللي بيتسجّل جوه شاشة بيموت مع الشاشة. لو الموظف كان في شاشة تانية
 * أو التطبيق كان مقفول، مكانش فيه حاجة تتعامل مع ضغطة الزرار.
 *
 * وبتفحص كمان لو التطبيق اتفتح أصلاً بسبب ضغطة على التنبيه (cold start)، لأن المستمع
 * العادي مبيلحقش يمسك الحالة دي.
 *
 * الفرق بين الزرارين:
 *   "سجّل انصرافي" / ضغطة على التنبيه ← بنمسح التنبيه بس، والسيرفر هيفكّره تاني
 *                                        في الموعد اللي بعده لو مسجّلش انصراف
 *   "لسه شغال"                        ← بنقول للسيرفر يسكت ساعتين
 */
export const registerCheckOutAckHandler = () => {
  const handle = async (response) => {
    if (!isCheckOutResponse(response)) return;

    await cancelCheckOutReminder();

    if (response.actionIdentifier === OVERTIME_ACTION_ID) {
      try {
        await api.post('/attendance/checkout-reminder/snooze');
      } catch (e) {
        // مفيش نت مثلاً - السيرفر هيفضل يفكّره، وده أأمن من إنه يسكت غلط
        console.log('تعذّر تأجيل تنبيه الانصراف:', e.message);
      }
    }
  };

  Notifications.getLastNotificationResponseAsync()
    .then((response) => { if (response) handle(response); })
    .catch(() => {});

  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
};

// نسخة قديمة محتفظ بيها عشان الشاشة الرئيسية - بتشتغل بس والتطبيق مفتوح
export const listenForCheckOutAcknowledge = (onAcknowledged) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (isCheckOutResponse(response) && response.actionIdentifier === ACK_ACTION_ID) {
      if (onAcknowledged) onAcknowledged();
    }
  });
  return () => subscription.remove();
};
