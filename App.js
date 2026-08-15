import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupBreakNotificationChannel } from './src/services/breakNotifications';

export default function App() {
  // بنستنى نتأكد فيه تحديث جديد ولا لأ قبل ما نفتح التطبيق العادي - عشان لو فيه تحديث، نحمّله ونعيد الفتح تلقائي
  // من غير ما اليوزر يحتاج يقفل التطبيق يدوي ويفتحه تاني مرتين
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkForUpdate();
    // بينشئ قناة تنبيه انتهاء الراحة على أندرويد (صوت المنبه + الاهتزاز + الأهمية القصوى) -
    // لازم تتعمل مرة واحدة بدري عند فتح التطبيق قبل أي محاولة جدولة تنبيه
    setupBreakNotificationChannel();
  }, []);

  const checkForUpdate = async () => {
    try {
      // في وضع التطوير (Expo Go / dev client) مفيش تحديثات OTA خالص - كمّل عادي على طول
      if (__DEV__ || !Updates.isEnabled) {
        setChecking(false);
        return;
      }
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return; // التطبيق هيعيد فتح نفسه تلقائي بالنسخة الجديدة، مش محتاجين نكمل تنفيذ أي حاجة تانية هنا
      }
    } catch (error) {
      // لو حصل أي خطأ (مفيش نت مثلًا) بنتجاهله ونكمّل بالنسخة الحالية المتاحة على الجهاز، بدل ما نعلّق المستخدم
      console.log('تعذّر التأكد من وجود تحديث جديد:', error.message);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111111" />
        <Text style={styles.loadingText}>جاري التحقق من التحديثات...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, color: '#777', fontSize: 13 }
});
