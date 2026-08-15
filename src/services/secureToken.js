// تخزين التوكن في SecureStore بدل AsyncStorage - SecureStore بيستخدم Keychain (iOS) وKeystore (Android)
// المشفرين على مستوى نظام التشغيل نفسه، بعكس AsyncStorage اللي بيتخزن كملف عادي غير مشفر على الجهاز.
//
// ⚠️ يحتاج تثبيت الحزمة الأول: npx expo install expo-secure-store
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = (value) => SecureStore.setItemAsync(TOKEN_KEY, value);

export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
