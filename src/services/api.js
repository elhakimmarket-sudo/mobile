import axios from 'axios';
import { getToken } from './secureToken';

// ⚠️ غيّر ده لو عنوان السيرفر بتاعك اتغير
const BASE_URL = 'https://api.elhakimhr.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000 // 60 ثانية - السيرفر الجديد بياخد وقت أطول (رفع صورة + حساب راتب)، الـ15 ثانية القديمة كانت قليلة
});

// إضافة التوكن تلقائيًا لكل الطلبات
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
export { BASE_URL };
