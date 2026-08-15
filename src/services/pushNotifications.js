import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from './api';

// بيخلي الإشعار يظهر فورًا حتى لو التطبيق فاتح قدام المستخدم وقت وصوله (مش بس لما يكون التطبيق مقفول/خلفية)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

/**
 * بتطلب إذن الإشعارات (لو لسه ماتطلبش قبل كده)، وبعدين تجيب "Expo push token" الخاص بجهاز
 * المستخدم وتبعته للسيرفر عشان يتسجل على حسابه - بعد كده أي إشعار (موافقة إجازة/سلفة/إلخ)
 * هيوصله فورًا حتى لو التطبيق مقفول.
 *
 * بتتنادى تلقائيًا من AuthContext بعد أي تسجيل دخول/فتح ناجح للتطبيق.
 */
export const registerForPushNotifications = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // المستخدم رفض إذن الإشعارات - ده حقه، منكملش ومنضايقوش بمحاولات تانية دلوقتي
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    if (token) {
      await api.put('/employees/me/push-token', { pushToken: token });
    }
  } catch (error) {
    // فشل تسجيل الإشعارات (مفيش نت، جهاز محاكي بدون دعم، إلخ) متستهلش توقف تسجيل الدخول
    console.log('تعذّر تسجيل توكن إشعارات Push:', error.message);
  }
};
