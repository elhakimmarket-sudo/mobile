import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import api from '../services/api';
import { getToken, setToken, removeToken } from '../services/secureToken';
import { registerForPushNotifications } from '../services/pushNotifications';

const AuthContext = createContext();

const MIN_BACKGROUND_MS_TO_LOCK = 3000; // أقل مدة في الخلفية عشان تتحسب "خروج حقيقي" - أقل من كده بيتجاهل (نوافذ نظام سريعة زي البصمة/الموقع/الأذونات)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appLocked, setAppLocked] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const userRef = useRef(null);
  const authInProgress = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    loadStoredUser();
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // كل مرة يبقى فيه يوزر مسجل دخول فعليًا وشايف التطبيق (مش قافل بالبصمة) - نسجّل/نحدّث توكن
  // إشعارات الـ Push بتاعه. جهاز الكيوسك المشترك مالوش حساب شخصي فمنسجلوش إشعارات خالص.
  useEffect(() => {
    if (user && !appLocked && user.role !== 'kiosk') {
      registerForPushNotifications();
    }
  }, [user, appLocked]);

  const handleAppStateChange = async (nextState) => {
    const previousState = appStateRef.current;
    appStateRef.current = nextState;

    // جهاز الكيوسك المشترك (يوزر المكتب) مبيتقفلش خالص - مفيش شخص واحد بصمته متسجلة عليه
    if (userRef.current && userRef.current.role === 'kiosk') return;

    // نافذة البصمة/Face ID بتاعة تأكيد الهوية (زي تسجيل الحضور) بتخلي النظام يحس إن التطبيق راح
    // للخلفية لحظة - ده مش خروج حقيقي، فنتجاهله تمامًا عشان مايفتحش شاشة القفل غلط
    if (authInProgress.current) return;

    if (nextState === 'background') {
      // التطبيق راح للخلفية - نسجل الوقت عشان نقدر نتأكد إنها فترة محسوسة فعلاً لما يرجع
      await AsyncStorage.setItem('lastBackgroundTime', String(Date.now()));
    } else if (previousState === 'background' && nextState === 'active') {
      if (!userRef.current) return;
      const lastBg = await AsyncStorage.getItem('lastBackgroundTime');
      const elapsed = lastBg ? Date.now() - Number(lastBg) : 0;
      // الجلسة متفضلش شغالة من غير تسجيل خروج - بس لازم يأكد هويته بالبصمة تاني كل ما يرجع للتطبيق
      if (elapsed > MIN_BACKGROUND_MS_TO_LOCK) {
        setAppLocked(true);
      }
      // لو المدة قليلة جدًا (أقل من العتبة)، متعملش أي حاجة - على الأغلب كانت نافذة نظام سريعة مش خروج حقيقي
    }
  };

  // بتستخدمها أي شاشة هتعمل تأكيد بصمة/Face ID بنفسها (زي شاشة تسجيل الحضور) عشان تحذّر
  // نظام قفل التطبيق إن أي تغيير حالة جاي دلوقتي سببه نافذة المصادقة نفسها، مش خروج حقيقي
  const setAuthInProgress = (value) => {
    authInProgress.current = value;
  };

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const token = await getToken();
      if (storedUser && token) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // كل مرة يتفتح فيها التطبيق من جديد (Cold start) لازم تأكيد هوية قبل ما يشوف أي حاجة
        // ما عدا جهاز الكيوسك المشترك (يوزر المكتب) - ده مالوش بصمة شخص واحد متسجلة عليه أصلًا
        if (parsedUser.role !== 'kiosk') {
          setAppLocked(true);
        }
      }
    } catch (e) {
      console.log('خطأ في تحميل بيانات المستخدم', e);
    } finally {
      setLoading(false);
    }
  };

  // تسجيل الدخول بقى برقم الهاتف بدل الإيميل
  const login = async (phone, password) => {
    const { data } = await api.post('/auth/login', { phone, password });
    await setToken(data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    setAppLocked(false);
    return data;
  };

  const logout = async () => {
    // نمسح توكن الإشعارات من السيرفر الأول (وإحنا لسه معانا التوكن اللي بيسمحلنا نعمل الطلب ده)
    // عشان الجهاز ده يوقف يستقبل إشعارات مرتبطة بالحساب بعد ما اليوزر يسجل خروج منه
    if (userRef.current && userRef.current.role !== 'kiosk') {
      try {
        await api.put('/employees/me/push-token', { pushToken: '' });
      } catch (e) {
        // مش مشكلة لو فشل (مفيش نت مثلًا) - مش هيمنع تسجيل الخروج نفسه
      }
    }
    await removeToken();
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('lastBackgroundTime');
    setUser(null);
    setAppLocked(false);
  };

  // بيطلب تأكيد الهوية بالبصمة/Face ID، ولو مش متسجلين على الجهاز بيرجع تلقائي لكود/نقش قفل الشاشة
  const unlockApp = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        // مفيش بصمة/Face ID أو حتى قفل شاشة متسجل على الجهاز - نفتح عادي من غير ما نعطّله
        setAppLocked(false);
        return true;
      }
      // نافذة تأكيد الهوية دي ممكن تاخد التطبيق للخلفية لحظة (خصوصًا لو المستخدم استخدم رمز الجهاز كبديل
      // للبصمة) - لازم نحذّر نظام القفل إن ده مش خروج حقيقي، وإلا هيفضل يعيد قفل التطبيق في حلقة مفرغة
      setAuthInProgress(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'أكّد هويتك لفتح التطبيق',
        fallbackLabel: 'استخدم كلمة مرور الجهاز',
        disableDeviceFallback: false
      });
      setAuthInProgress(false);
      if (result.success) {
        setAppLocked(false);
        return true;
      }
      return false;
    } catch (e) {
      console.log('خطأ في المصادقة المحلية', e);
      setAuthInProgress(false);
      return false;
    }
  };

  // زرار "تسجيل بالبصمة" على شاشة الدخول نفسها - لو فيه جلسة محفوظة (توكن قديم)، بيرجّعها بعد تأكيد الهوية
  // من غير ما يحتاج يكتب رقم الهاتف وكلمة المرور تاني
  const loginWithBiometrics = async () => {
    const storedUser = await AsyncStorage.getItem('user');
    const token = await getToken();
    if (!storedUser || !token) {
      return { success: false, message: 'مفيش جلسة محفوظة على الجهاز ده - سجل الدخول برقم الهاتف وكلمة المرور الأول' };
    }
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        return { success: false, message: 'مفيش بصمة أو Face ID متسجلة على الجهاز ده' };
      }
      // نفس التحذير هنا كمان - نافذة المصادقة ممكن تاخد التطبيق للخلفية لحظة، مش خروج حقيقي
      setAuthInProgress(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'أكّد هويتك للدخول',
        fallbackLabel: 'استخدم كلمة مرور الجهاز',
        disableDeviceFallback: false
      });
      setAuthInProgress(false);
      if (result.success) {
        setUser(JSON.parse(storedUser));
        setAppLocked(false);
        return { success: true };
      }
      return { success: false, message: 'فشلت المصادقة' };
    } catch (e) {
      console.log('خطأ في تسجيل الدخول بالبصمة', e);
      setAuthInProgress(false);
      return { success: false, message: 'حدث خطأ أثناء المصادقة' };
    }
  };

  // بتحدّث بيانات اليوزر المحفوظة محليًا (زي بعد ما يغيّر صورته الشخصية) من غير ما يحتاج يسجل دخول تاني
  const updateUserFields = async (fields) => {
    const updated = { ...user, ...fields };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  // طريقة بديلة لفتح التطبيق - بكلمة مرور الحساب نفسه بدل البصمة/رمز الجهاز، لأجهزة معينة بيبقى فيها
  // نظام البصمة/الرمز غير مستقر (بيدخل في حلقة قفل مفرغة) - دي وسيلة احتياطية مضمونة تشتغل في كل الحالات
  const unlockWithPassword = async (password) => {
    try {
      if (!userRef.current?.phone) {
        return { success: false, message: 'تعذر التحقق من الحساب' };
      }
      const { data } = await api.post('/auth/login', { phone: userRef.current.phone, password });
      await setToken(data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      setAppLocked(false);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.response?.data?.message || 'كلمة المرور غير صحيحة' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, appLocked, login, logout, unlockApp, unlockWithPassword, loginWithBiometrics, setAuthInProgress, updateUserFields }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
