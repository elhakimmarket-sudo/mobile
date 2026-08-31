import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ⚠️ قنوات أندرويد ثابتة بعد إنشائها: أول ما القناة تتعمل مرة واحدة على الجهاز، أي تعديل في
// إعداداتها (الصوت/الاهتزاز/الأهمية) في الكود مش بيتطبق عليها تاني خالص - الطريقة الوحيدة
// إن القناة تتعمل من جديد بإعدادات مختلفة إنك تغيّر الـ ID نفسه. عشان كده فيه رقم نسخة في
// آخر الاسم - أي مرة نغيّر إعدادات القناة لازم نزوّد الرقم ده
const CHANNEL_ID = 'break-end-alarm-v2';

// نوع التنبيه - بنستخدمه في الإلغاء عشان نلغي تنبيهات الراحة بس من غير ما نمس تنبيهات تانية
const NOTIFICATION_TYPE = 'break-end';


// ملحوظة مهمة: ده مش صوت واحد مستمر بيلف على نفسه (ده محتاج مكتبة تنبيهات أقوى زي notifee
// + تعديل نيتيف)، لكنه تنبيهات منفصلة متكررة بنفس صوت المنبه القوي كل شوية، عشان يحس
// المستخدم إن الموبايل "بيرن" باستمرار لحد ما يفتح التطبيق وينهي الراحة
const REPEAT_COUNT = 20;
const REPEAT_INTERVAL_SECONDS = 8;

// لازم تتنادى مرة واحدة عند بدء التطبيق (في App.js)
export const setupBreakNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'تنبيه انتهاء الراحة',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600, 300, 600, 300, 600],
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC
    });
  }
};

export const requestNotificationPermissions = async () => {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
};

// بيجدول "رنة" منبه متكررة تبدأ بالظبط وقت انتهاء الراحة وتفضل تتكرر لحد ما الموظف
// يفتح التطبيق وينهي الراحة - بتشتغل حتى لو التطبيق في الخلفية أو مقفول تمامًا
export const scheduleBreakEndNotification = async (endDate) => {
  await cancelBreakNotification(); // امسح أي تنبيهات قديمة متجدولة الأول

  const baseSeconds = Math.max(1, Math.round((endDate.getTime() - Date.now()) / 1000));

  await Promise.all(
    Array.from({ length: REPEAT_COUNT }, (_, i) => {
      const seconds = baseSeconds + i * REPEAT_INTERVAL_SECONDS;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ انتهت فترة الراحة',
          body: 'الوقت المسموح للراحة خلص - يرجى العودة للعمل',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: { type: NOTIFICATION_TYPE }
        },
        // ⚠️ لازم نحدد نوع الـ trigger صراحةً في expo-notifications 0.32 (Expo SDK 54).
        // الاختصار القديم { seconds } من غير type مابقاش بيتفهم صح، والنتيجة إن التنبيه
        // مكانش بيترن أصلاً لما التطبيق يبقى مقفول
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
          channelId: CHANNEL_ID
        }
      });
    })
  );
};

// ⚠️ بتلغي تنبيهات الراحة بس - مش كل التنبيهات المجدولة (عشان ماتمسحش تنبيه "متنساش تسجيل الانصراف").
//
// بتشتغل بالبحث في التنبيهات المجدولة فعليًا على الجهاز وفلترتها بالنوع، مش بمصفوفة IDs محفوظة
// في الذاكرة. السبب: أي مصفوفة في الذاكرة بتضيع أول ما التطبيق يتقفل، فالتنبيهات القديمة
// المجدولة من جلسة سابقة كانت بتفضل موجودة ومحدش يقدر يلغيها - وبعدين ترن فجأة أول ما
// الموظف يبدأ راحة جديدة ويقوله "خلصت الراحة" وهو لسه بادئ
export const cancelBreakNotification = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content?.data?.type === NOTIFICATION_TYPE)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (e) {
    // مش مهم لو فشل جزء منها - ممكن يكون اتنفذ بالفعل
  }

  // وكمان نشيل أي تنبيهات اتعرضت فعلاً وسايبة في شريط الإشعارات
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => n.request?.content?.data?.type === NOTIFICATION_TYPE)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch (e) {
    // التنبيهات هتختفي لوحدها لما المستخدم يمسحها
  }
};
