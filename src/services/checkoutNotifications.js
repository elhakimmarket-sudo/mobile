// تنبيه "متنساش تسجيل الانصراف" - بيرن في ميعاد نهاية الوردية الرسمي ويتكرر بفواصل متباعدة
// لحد ما الموظف يتعامل معاه أو يسجل انصراف فعليًا.
//
// ليه تنبيه محلي مجدول (مش من السيرفر): عشان يشتغل بالظبط في الميعاد حتى لو التطبيق مقفول
// تمامًا أو مفيش نت - نظام التشغيل نفسه هو اللي بيرنّه. (التنبيه التاني، بتاع الساعات
// الزيادة، بيتبعت من السيرفر لأنه لازم يوصل حتى لو التطبيق متشال من الجهاز خالص)

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ⚠️ قنوات أندرويد ثابتة بعد إنشائها - أي تعديل في إعدادات القناة محتاج ID جديد (شوف نفس
// الملحوظة في breakNotifications.js)
const CHANNEL_ID = 'checkout-reminder-v2';

// ⚠️ الـ ID بيتزوّد رقمه مع أي تغيير في الأزرار، عشان الإعدادات الجديدة تتطبق على الأجهزة
// اللي شغالة بنسخة قديمة
const CATEGORY_ID = 'checkout-reminder-actions-v4';
const ACK_ACTION_ID = 'checkout-ack';
const OVERTIME_ACTION_ID = 'checkout-overtime';
const NOTIFICATION_TYPE = 'checkout-reminder';

// مواعيد التكرار بالدقايق بعد نهاية الوردية. متباعدة بالتدريج بدل ٢٠ مرة كل ٣٠ ثانية -
// أهدى على الموظف وبتغطي وقت أطول (ساعة وعشرين بدل عشر دقايق).
const REMINDER_OFFSETS_MINUTES = [0, 2, 5, 10, 20, 35, 55, 80];

// "هسجل دلوقتي" - تذكير قصير
const SNOOZE_MINUTES = 10;

// "لسه شغال / أوفر تايم" - بنسكت ساعتين كاملين وبعدين نسأله تاني.
// الأوفر تايم بحد أقصى ٩ ساعات، يعني على الأكتر هيتسأل ٤ مرات في اليوم كله.
const OVERTIME_SNOOZE_MINUTES = 120;

const CONTENT = {
  end: {
    title: 'متنساش تسجيل الانصراف',
    body: 'وردية النهاردة خلصت - سجّل انصرافك من التطبيق'
  },
  overtime: {
    title: 'لسه في الشغل؟',
    body: 'متنساش تسجّل انصرافك أول ما تمشي - الأوفر تايم بيتحسب من وقت الانصراف'
  }
};

const notificationContent = (endKey, variant = 'end') => ({
  title: CONTENT[variant].title,
  body: CONTENT[variant].body,
  priority: Notifications.AndroidNotificationPriority.MAX,
  categoryIdentifier: CATEGORY_ID,
  data: { type: NOTIFICATION_TYPE, endKey, variant }
});

export const setupCheckoutNotificationChannel = async () => {
  // ⚠️ الزرارين لازم يفتحوا التطبيق (opensAppToForeground: true).
  // السبب: أندرويد مش بيشغّل كود التطبيق لما التطبيق مقفول والزرار مش بيفتحه، فالتنبيهات
  // المتكررة اللي لسه جاية مكانش فيه حاجة تلغيها - وده كان بيخلي الموظف يدوس ويدوس والتنبيه
  // بيفضل يرن. دلوقتي أول ما يدوس، التطبيق بيفتح وبيلغيها فعلًا.
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

const scheduleOne = (seconds, endKey, variant) =>
  Notifications.scheduleNotificationAsync({
    content: notificationContent(endKey, variant),
    // ⚠️ لازم نوع الـ trigger يتحدد صراحةً في expo-notifications 0.32 (Expo SDK 54) -
    // الاختصار القديم { seconds } لوحده مكانش بيشتغل لما التطبيق يكون مقفول
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      channelId: CHANNEL_ID
    }
  });

const listScheduled = async () => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.filter((n) => n.content?.data?.type === NOTIFICATION_TYPE);
  } catch (e) {
    return [];
  }
};

/**
 * بتجدول التنبيهات على مواعيد ثابتة محسوبة من نهاية الوردية.
 *
 * أهم حاجتين هنا:
 *  - أي موعد فات خلاص بيتشال. يعني لو الموظف فتح التطبيق بعد نهاية الوردية بساعتين،
 *    مش هيترن عليه كل التنبيهات مرة واحدة (ده كان بيحصل قبل كده لأن الجدولة كانت
 *    نسبية من لحظة الفتح مش من نهاية الوردية).
 *  - لو التنبيهات متجدولة خلاص لنفس الوردية، بنسيبها زي ما هي. من غير الفحص ده كانت
 *    الشاشة الرئيسية بتعيد جدولتها كل مرة تتفتح وتلغي أي تأجيل الموظف عمله.
 */
export const scheduleCheckOutReminder = async (officialEndDate) => {
  const endMs = new Date(officialEndDate).getTime();
  if (!endMs || Number.isNaN(endMs)) return;
  const endKey = new Date(endMs).toISOString();

  const existing = await listScheduled();
  if (existing.length > 0 && existing.some((n) => n.content?.data?.endKey === endKey)) {
    return; // متجدولة بالفعل لنفس الوردية - بلاش نلخبطها
  }

  await cancelCheckOutReminder();

  const now = Date.now();
  const times = REMINDER_OFFSETS_MINUTES
    .map((m) => Math.round((endMs + m * 60000 - now) / 1000))
    .filter((seconds) => seconds >= 1);

  await Promise.all(times.map((seconds) => scheduleOne(seconds, endKey, 'end')));
};

// تأجيل: بتسكّت اللي جاي وبترجع تفكّره مرة واحدة بعد المدة المطلوبة
export const snoozeCheckOutReminder = async (endKey, minutes = SNOOZE_MINUTES, variant = 'end') => {
  await cancelCheckOutReminder();
  await scheduleOne(minutes * 60, endKey || new Date().toISOString(), variant);
};

// بتلغي بالبحث في التنبيهات المجدولة على الجهاز وفلترتها بالنوع، مش بمصفوفة IDs في الذاكرة -
// عشان المصفوفة بتضيع لما التطبيق يتقفل وتفضل التنبيهات القديمة مجدولة من غير ما حد يقدر يلغيها
export const cancelCheckOutReminder = async () => {
  try {
    const scheduled = await listScheduled();
    await Promise.all(scheduled.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
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

// بترجع true لو الرد ده خاص بتنبيه الانصراف
const isCheckOutResponse = (response) =>
  response?.notification?.request?.content?.data?.type === NOTIFICATION_TYPE;

/**
 * بتتنادى مرة واحدة عند فتح التطبيق (من App.js) - مش من شاشة معيّنة.
 *
 * ليه: المستمع اللي بيتسجّل جوه شاشة بيموت مع الشاشة. لو الموظف كان في شاشة تانية أو
 * التطبيق كان مقفول، مكانش فيه حاجة تلغي التنبيهات المتكررة.
 *
 * وبتفحص كمان لو التطبيق اتفتح أصلاً بسبب ضغطة على التنبيه (cold start)، لأن المستمع
 * العادي مبيلحقش يمسك الحالة دي.
 *
 * الفرق بين الزرارين:
 *   "سجّل انصرافي" / ضغطة على التنبيه نفسه  ← تذكير تاني بعد ١٠ دقايق
 *   "لسه شغال"                              ← سكوت ساعتين، وبعدين سؤال بصيغة مختلفة
 */
export const registerCheckOutAckHandler = () => {
  const handle = async (response) => {
    if (!isCheckOutResponse(response)) return;
    const endKey = response.notification.request.content.data?.endKey;

    if (response.actionIdentifier === OVERTIME_ACTION_ID) {
      await snoozeCheckOutReminder(endKey, OVERTIME_SNOOZE_MINUTES, 'overtime');
      return;
    }
    await snoozeCheckOutReminder(endKey, SNOOZE_MINUTES, 'end');
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
