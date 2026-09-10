import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setForcedLogoutHandler } from '../services/api';
import { getToken, setToken, removeToken } from '../services/secureToken';
import { registerForPushNotifications } from '../services/pushNotifications';
import { cancelCheckOutReminder } from '../services/checkoutNotifications';

const AuthContext = createContext();

// ⚠️ قفل التطبيق بالبصمة/رمز الجهاز اتشال بالكامل.
// السبب: على الموبايلات القديمة نافذة المصادقة كانت بتعلّق التطبيق أو تدخّله في حلقة قفل
// مفرغة. الحماية الحقيقية لتسجيل الحضور هي الصورة + نطاق الموقع، والاتنين لسه شغالين.
// appLocked فضلت موجودة وقيمتها false دايمًا عشان باقي الكود ميتكسرش.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const appLocked = false;
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    loadStoredUser();
  }, []);

  // كل مرة يبقى فيه يوزر مسجل دخول فعليًا وشايف التطبيق (مش قافل بالبصمة) - نسجّل/نحدّث توكن
  // إشعارات الـ Push بتاعه. جهاز الكيوسك المشترك مالوش حساب شخصي فمنسجلوش إشعارات خالص.
  useEffect(() => {
    if (user && user.role !== 'kiosk') {
      registerForPushNotifications();
    }
  }, [user]);

  // بتتنادى من شاشة تسجيل الحضور - سيبناها كدالة فاضية عشان الشاشة ماتتكسرش
  const setAuthInProgress = () => {};

  // -------------------------------------------------------------------------
  // إيقاف الحساب من لوحة التحكم
  //
  // السيرفر بيرفض كل طلبات الموظف الموقوف من الأول، بس ده لوحده مكانش بيقفل التطبيق عنده:
  // بيانات الدخول كانت متخزّنة على الجهاز، فكان بيفضل يفتح التطبيق ويتفرّج على بياناته
  // القديمة. دلوقتي أول رد من السيرفر بكود ACCOUNT_INACTIVE بيمسح الجلسة فورًا.
  // -------------------------------------------------------------------------

  // بتمسح الجلسة محليًا من غير أي طلب للسيرفر.
  // ⚠️ مهم إنها متعملش أي طلب: الحساب متوقف أصلًا، فأي طلب هيترفض ويرجّع تشغيل نفس
  // المعالج ده تاني في حلقة لا نهائية.
  const clearSession = async () => {
    try { await cancelCheckOutReminder(); } catch (e) {}
    await removeToken();
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('lastBackgroundTime');
    setUser(null);
  };

  // قفل بسيط عشان لو كذا طلب فشل مع بعض ميظهرش كذا رسالة ورا بعض
  const forcedLogoutInFlight = useRef(false);

  useEffect(() => {
    setForcedLogoutHandler(async (code) => {
      if (forcedLogoutInFlight.current) return;
      if (!userRef.current) return; // مفيش حد مسجّل دخول أصلًا - مفيش حاجة نمسحها
      // ⚠️ جهاز المكتب (الكيوسك) بره الموضوع ده خالص. توكنه مش مربوط بموظف، فلو مرّ على
      // راوت عادي هيرجّع TOKEN_INVALID وهنطلّعه من التطبيق غلط - والجهاز ده مشترك ومحدش
      // حافظ بياناته عشان يرجع يسجّل دخول تاني.
      if (userRef.current.role === 'kiosk') return;
      forcedLogoutInFlight.current = true;
      try {
        await clearSession();
        Alert.alert(
          code === 'ACCOUNT_INACTIVE' ? 'الحساب متوقف' : 'انتهت الجلسة',
          code === 'ACCOUNT_INACTIVE'
            ? 'حسابك اتوقف من الإدارة. تواصل مع المسؤول لو ده حصل بالغلط.'
            : 'برجاء تسجيل الدخول تاني.'
        );
      } finally {
        // بنفضّيه بعد شوية عشان الطلبات اللي كانت طايرة في نفس اللحظة متفتحش رسالة تانية
        setTimeout(() => { forcedLogoutInFlight.current = false; }, 3000);
      }
    });
  }, []);

  // بنسأل السيرفر "الحساب ده لسه شغال؟" عند فتح التطبيق وكل ما يرجع من الخلفية.
  // من غير كده الموظف الموقوف مكانش هيتخرّج غير لما يعمل حاجة تحتاج السيرفر.
  // لو مفيش نت الطلب بيفشل من غير response والمعالج بيتجاهله - مش بنخرّج حد بسبب الشبكة.
  const verifySession = async () => {
    if (!userRef.current) return;
    if (userRef.current.role === 'kiosk') return; // الكيوسك ملوش حساب موظف يتسأل عنه
    try { await api.get('/auth/me'); } catch (e) {}
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') verifySession();
    });
    return () => sub.remove();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const token = await getToken();
      if (storedUser && token) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        userRef.current = parsedUser; // بنحدّثها فورًا عشان verifySession اللي جاية تلاقيها
        verifySession();
      }
    } catch (e) {
      console.log('خطأ في تحميل بيانات المستخدم', e);
    } finally {
      setLoading(false);
    }
  };

  // تسجيل الدخول بقى برقم الهاتف بدل الإيميل
  const login = async (phone, password) => {
    // rememberMe: true دايمًا هنا - ده تطبيق متركّب على موبايل الموظف الشخصي،
    // مش متصفح على جهاز مشترك، فمفيش سبب يخرّجه كل أسبوع ويخليه يكتب كلمة السر تاني.
    // السيرفر بيدّي توكن ٩٠ يوم، وإيقاف الحساب لسه بيقفله فورًا مهما كانت المدة.
    const { data } = await api.post('/auth/login', { phone, password, rememberMe: true });
    await setToken(data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = async () => {
    // بنقفل معالج الخروج الإجباري وإحنا بنسجّل خروج بإرادتنا: لو الحساب كان متوقف أصلًا،
    // طلب مسح توكن الإشعارات تحت هيترفض وهتطلع رسالة "الحساب متوقف" في وش حد لسه دايس خروج
    forcedLogoutInFlight.current = true;

    // نمسح توكن الإشعارات من السيرفر الأول (وإحنا لسه معانا التوكن اللي بيسمحلنا نعمل الطلب ده)
    // عشان الجهاز ده يوقف يستقبل إشعارات مرتبطة بالحساب بعد ما اليوزر يسجل خروج منه
    if (userRef.current && userRef.current.role !== 'kiosk') {
      try {
        await api.put('/employees/me/push-token', { pushToken: '' });
      } catch (e) {
        // مش مشكلة لو فشل (مفيش نت مثلًا) - مش هيمنع تسجيل الخروج نفسه
      }
    }
    await clearSession();
    setTimeout(() => { forcedLogoutInFlight.current = false; }, 3000);
  };

  // بتحدّث بيانات اليوزر المحفوظة محليًا (زي بعد ما يغيّر صورته الشخصية) من غير ما يحتاج يسجل دخول تاني
  const updateUserFields = async (fields) => {
    const updated = { ...user, ...fields };
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, appLocked, login, logout, setAuthInProgress, updateUserFields }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
