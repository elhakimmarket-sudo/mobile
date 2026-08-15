import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// قناة أندرويد خاصة بتنبيه انتهاء الراحة - أهمية قصوى + اهتزاز طويل + صوت منبه مخصص
const CHANNEL_ID = 'break-end-alarm';

// اسم ملف الصوت المخصص (لازم يتحط في mobile/assets/sounds/break-alarm.wav
// ويتسجل في app.json جوه plugin "expo-notifications" -> "sounds"). لو الملف مش موجود
// وقت البناء، النظام هيرجع تلقائيًا لصوت التنبيهات الافتراضي بدل ما يكسر التطبيق.
const ALARM_SOUND_FILE = 'break-alarm.wav.wav';

// عدد مرات تكرار "الرنة" بعد وقت انتهاء الراحة، والفاصل بينهم بالثواني.
// ملحوظة مهمة: ده مش صوت واحد مستمر بيلف على نفسه (ده محتاج مكتبة تنبيهات أقوى
// زي notifee + تعديل نيتيف)، لكنه تنبيهات منفصلة متكررة بنفس صوت المنبه القوي كل شوية،
// عشان يحس المستخدم إن الموبايل "بيرن" باستمرار لحد ما يفتح التطبيق وينهي الراحة -
// وده بيشتغل حتى لو التطبيق مقفول تمامًا على أندرويد وآيفون لأنه إشعارات مجدولة من نظام التشغيل نفسه.
const REPEAT_COUNT = 20;
const REPEAT_INTERVAL_SECONDS = 8;

// لازم تتنادى مرة واحدة عند بدء التطبيق (في App.js)
export const setupBreakNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'تنبيه انتهاء الراحة',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600, 300, 600, 300, 600],
      sound: ALARM_SOUND_FILE,
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

let scheduledNotificationIds = [];

// بيجدول "رنة" منبه متكررة تبدأ بالظبط وقت انتهاء الراحة وتفضل تتكرر لحد ما الموظف
// يفتح التطبيق وينهي الراحة - بتشتغل حتى لو التطبيق في الخلفية أو مقفول تمامًا
export const scheduleBreakEndNotification = async (endDate) => {
  await cancelBreakNotification(); // امسح أي تنبيهات قديمة متجدولة الأول

  const baseSeconds = Math.max(1, Math.round((endDate.getTime() - Date.now()) / 1000));

  const ids = await Promise.all(
    Array.from({ length: REPEAT_COUNT }, (_, i) => {
      const seconds = baseSeconds + i * REPEAT_INTERVAL_SECONDS;
      return Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ انتهت فترة الراحة',
          body: 'الوقت المسموح للراحة خلص - يرجى العودة للعمل',
          sound: ALARM_SOUND_FILE,
          priority: Notifications.AndroidNotificationPriority.MAX
        },
        trigger: {
          seconds,
          channelId: CHANNEL_ID
        }
      });
    })
  );

  scheduledNotificationIds = ids;
};

export const cancelBreakNotification = async () => {
  if (scheduledNotificationIds.length > 0) {
    try {
      await Promise.all(scheduledNotificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    } catch (e) {
      // ممكن يكون جزء منها اتنفذ بالفعل، تجاهل الخطأ
    }
    scheduledNotificationIds = [];
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
};
