import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { COLORS, FIELD_SHADOW } from '../theme/colors';

// رسائل ترحيب بتتغير عشوائيًا في كل مرة يسجل فيها الموظف دخول
const WELCOME_MESSAGES = [
  'نورت تاني 👋',
  'الحمد لله ع السلامة 🙏',
  'أهلاً بيك في الشغل 💪',
  'يوم شغل سعيد إن شاء الله ☀️',
  'ربنا يوفقك في شغلك النهاردة 🌟'
];

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // الحقل اللي المؤشر فيه دلوقتي - عشان نلوّن إطاره. React Native ملوش :focus
  // زي الويب، فلازم نمسك الحالة بإيدنا.
  const [focused, setFocused] = useState(null);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('تنبيه', 'من فضلك أدخل رقم الهاتف وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      await login(phone.trim(), password, rememberMe);
      const message = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      Alert.alert('أهلاً بيك', message);
    } catch (error) {
      const msg = error.response?.data?.message || 'حدث خطأ أثناء تسجيل الدخول';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  // ⚠️ متعملش من الحقل ده كومبوننت جوه الدالة دي. React بيعتبره نوع جديد كل مرة
  // الشاشة تترسم، فبيهدّه ويبنيه من الأول - والنتيجة إن الكيبورد بيتقفل بعد كل حرف.
  // مكرر مرتين بإيدنا وده أأمن.

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="cover" />
        </View>

        <Text style={styles.brand}>الحكيم</Text>
        <Text style={styles.tagline}>نظام الحضور والانصراف</Text>

        <Text style={styles.label}>رقم الهاتف</Text>
        <View style={[styles.field, focused === 'phone' && styles.fieldFocused]}>
          <Ionicons
            name="call-outline"
            size={17}
            color={focused === 'phone' ? COLORS.primary : COLORS.gray}
          />
          <TextInput
            style={styles.input}
            placeholder="01xxxxxxxxx"
            placeholderTextColor="#B6BDC9"
            value={phone}
            onChangeText={setPhone}
            onFocus={() => setFocused('phone')}
            onBlur={() => setFocused(null)}
            keyboardType="phone-pad"
            textAlign="right"
            autoComplete="tel"
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>كلمة المرور</Text>
        <View style={[styles.field, focused === 'password' && styles.fieldFocused]}>
          <Ionicons
            name="lock-closed-outline"
            size={17}
            color={focused === 'password' ? COLORS.primary : COLORS.gray}
          />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#B6BDC9"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            secureTextEntry={!showPassword}
            textAlign="right"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.gray} />
          </TouchableOpacity>
        </View>

        {/* مفعّل افتراضيًا: ده موبايل الموظف الشخصي، مش جهاز مشترك.
            بيخلي السيرفر يدّي جلسة ٩٠ يوم بدل ٧ - مش بيخزّن كلمة السر في أي مكان. */}
        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberMe((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
            {rememberMe && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
          </View>
          <Text style={styles.rememberText}>خليني مسجّل دخول</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.buttonText}>دخول</Text>}
        </TouchableOpacity>

        <Text style={styles.footerNote}>نسيت كلمة المرور؟ كلّم الإدارة</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  // justifyContent: center بيوسّط الفورم رأسيًا لما فيه مساحة، و flexGrow بيخلي
  // الـ ScrollView يشتغل عادي لما الكيبورد يطلع ويضيّق المساحة
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 32 },

  logoWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 18,
    backgroundColor: COLORS.white,
    ...FIELD_SHADOW,
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 4
  },
  logo: { width: '100%', height: '100%' },

  brand: { fontSize: 27, fontWeight: '900', textAlign: 'center', color: COLORS.black, letterSpacing: -0.3 },
  tagline: { fontSize: 13, textAlign: 'center', color: COLORS.label, marginTop: 3, marginBottom: 30 },

  label: { fontSize: 12.5, fontWeight: '600', color: COLORS.label, textAlign: 'right', marginBottom: 7 },

  // الحقل عايم على الخلفية بظل خفيف بدل الإطار الرمادي - ده أساس شكل "النهار"
  field: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: 13,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 16,
    ...FIELD_SHADOW
  },
  fieldFocused: { borderColor: COLORS.primary },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.black },

  rememberRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, marginTop: 2, marginBottom: 22 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C6CDD9',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxOn: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },
  rememberText: { fontSize: 13.5, color: COLORS.label },

  button: {
    backgroundColor: COLORS.navy,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

  footerNote: { fontSize: 12.5, color: COLORS.gray, textAlign: 'center', marginTop: 18 }
});
