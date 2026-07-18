import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ غيّر الرابط ده لعنوان السيرفر بتاعك
// وقت التطوير المحلي: استخدم IP جهازك بدل localhost (مثال: http://192.168.1.9:5000/api)
const BASE_URL = 'http://192.168.1.9:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
});

// إضافة التوكن تلقائيًا لكل الطلبات
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { BASE_URL };
