// تنبيه "متنساش تسجيل الانصراف" - بيترن في ميعاد نهاية الوردية الرسمي بالظبط ويفضل يتكرر
// لحد ما الموظف يضغط "تمام" أو يسجل انصراف فعليًا.
//
// ليه تنبيه محلي مجدول (مش من السيرفر): عشان يشتغل بالظبط في الميعاد حتى لو التطبيق مقفول
// تمامًا أو مفيش نت - نظام التشغيل نفسه هو اللي بيرنّه. (التنبيه التاني، بتاع الـ9 ساعات،
// بيتبعت من السيرفر لأنه لازم يوصل حتى لو التطبيق متشال من الجهاز خالص)

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ⚠️ قنوات أندرويد ثابتة بعد إنشائها - أي تعديل في إعدادات القناة محتاج ID جديد (شوف نفس
// الملحوظة في breakNotifications.js)
const CHANNEL_ID = 'checkout-reminder-v2';
const CATEGORY_ID = 'checkout-reminder-actions';
const ACK_ACTION_ID = 'checkout-ack';
const NOTIFICATION_TYPE = 'checkout-reminder';

// نفس فلسفة تنبيه الراحة: تنبيهات متكررة بفاصل قصير بدل صوت واحد مستمر (اللي محتاج مكتبة
// نيتيف أقوى)، عشان يحس المستخدم إن الموبايل بيرن لحد ما يتعامل مع التنبيه
const REPEAT_COUNT = 20;
const REPEAT_INTERVAL_SECONDS = 30;

export const setupCheckoutNotificationChannel = async () => {
  // زرار "تمام" اللي بيظهر تحت التنبيه نفسه من غير ما المستخدم يفتح التطبيق
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    { identifier: ACK_ACTION_ID, buttonTitle: 'تمام', options: { opensAppToForeground: false } }
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

let scheduledIds = [];

// بيجدول التنبيه يبدأ في ميعاد نهاية الوردية بالظبط. لو الميعاد فات خلاص (الموظف فتح التطبيق
// بعد ما الوردية خلصت وهو لسه ماسجلش انصراف)، بيرن فورًا بدل ما يتجاهل
export const scheduleCheckOutReminder = async (officialEndDate) => {
  await cancelCheckOutReminder();

  const baseSeconds = Math.max(1, Math.round((new Date(officialEndDate).getTime() - Date.now()) / 1000));

  const ids = await Promise.all(
    Array.from({ length: REPEAT_COUNT }, (_, i) => {
      const seconds = baseSeconds + i * REPEAT_INTERVAL_SECONDS;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: 'متنساش تسجيل الانصراف',
          body: 'وردية النهاردة خلصت - سجّل انصرافك من التطبيق',
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: CATEGORY_ID,
          data: { type: NOTIFICATION_TYPE }
        },
        // ⚠️ لازم نوع الـ trigger يتحدد صراحةً في expo-notifications 0.32 (Expo SDK 54) -
        // الاختصار القديم { seconds } لوحده مكانش بيشتغل لما التطبيق يكون مقفول
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
          channelId: CHANNEL_ID
        }
      });
    })
  );

  scheduledIds = ids;
};

// بتلغي بالبحث في التنبيهات المجدولة على الجهاز وفلترتها بالنوع، مش بمصفوفة IDs في الذاكرة -
// عشان المصفوفة بتضيع لما التطبيق يتقفل وتفضل التنبيهات القديمة مجدولة من غير ما حد يقدر يلغيها
export const cancelCheckOutReminder = async () => {
  scheduledIds = [];

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content?.data?.type === NOTIFICATION_TYPE)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (e) {
    // ممكن يكون جزء منها اتنفذ بالفعل، تجاهل الخطأ
  }

  // نمسح كمان أي تنبيهات اتعرضت فعلاً وسايبة في شريط الإشعارات
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

// بتربط زرار "تمام" اللي جوه التنبيه: أول ما المستخدم يدوس عليه، كل التنبيهات المتكررة
// اللي لسه جاية بتتلغي. بترجع دالة إلغاء الاشتراك عشان تتنادى وقت unmount
export const listenForCheckOutAcknowledge = (onAcknowledged) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    if (response.actionIdentifier === ACK_ACTION_ID) {
      await cancelCheckOutReminder();
      if (onAcknowledged) onAcknowledged();
    }
  });
  return () => subscription.remove();
};
