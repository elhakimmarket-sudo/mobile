import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// قناة أندرويد خاصة بتنبيه انتهاء الراحة - أهمية قصوى + اهتزاز طويل + صوت
const CHANNEL_ID = 'break-end-alarm';

// لازم تتنادى مرة واحدة عند بدء التطبيق (في App.js)
export const setupBreakNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'تنبيه انتهاء الراحة',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600, 300, 600, 300, 600],
      sound: 'default',
      enableVibrate: true,
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

let scheduledNotificationId = null;

// بيجدول إشعار محلي يظهر بالظبط وقت انتهاء الراحة - بيشتغل حتى لو التطبيق في الخلفية أو مقفول
export const scheduleBreakEndNotification = async (endDate) => {
  await cancelBreakNotification(); // امسح أي تنبيه قديم متجدول الأول

  const secondsUntilEnd = Math.max(1, Math.round((endDate.getTime() - Date.now()) / 1000));

  scheduledNotificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ انتهت فترة الراحة',
      body: 'الوقت المسموح للراحة خلص - يرجى العودة للعمل',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX
    },
    trigger: {
      seconds: secondsUntilEnd,
      channelId: CHANNEL_ID
    }
  });
};

export const cancelBreakNotification = async () => {
  if (scheduledNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
    } catch (e) {
      // ممكن يكون اتنفذ بالفعل، تجاهل الخطأ
    }
    scheduledNotificationId = null;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
};
