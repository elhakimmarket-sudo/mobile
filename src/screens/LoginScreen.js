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
import { useAuth } from '../context/AuthContext';

// رسائل ترحيب بتتغير عشوائيًا في كل مرة يسجل فيها الموظف دخول
const WELCOME_MESSAGES = [
  'نورت تاني 👋',
  'الحمد لله ع السلامة 🙏',
  'أهلاً بيك في الشغل 💪',
  'يوم شغل سعيد إن شاء الله ☀️',
  'ربنا يوفقك في شغلك النهاردة 🌟'
];

export default function LoginScreen() {
  const { login, loginWithBiometrics } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('تنبيه', 'من فضلك أدخل رقم الهاتف وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      await login(phone.trim(), password);
      const message = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
      Alert.alert('أهلاً بيك', message);
    } catch (error) {
      const msg = error.response?.data?.message || 'حدث خطأ أثناء تسجيل الدخول';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBioLoading(true);
    const result = await loginWithBiometrics();
    setBioLoading(false);
    if (!result.success) {
      Alert.alert('تنبيه', result.message || 'تعذر تسجيل الدخول بالبصمة');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.loginBox}>
          <View style={styles.brandMark}>
            <Image source={require('../../assets/logo.jpg')} style={styles.logoImage} />
          </View>

          <Text style={styles.title}>Elhakim HR System</Text>
          <Text style={styles.subtitle}>تسجيل الدخول</Text>

          <Text style={styles.label}>رقم الهاتف</Text>
          <TextInput
            style={styles.input}
            placeholder="رقم الهاتف"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign="right"
          />

          <Text style={styles.label}>كلمة المرور</Text>
          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="right"
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>دخول</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometricLogin} disabled={bioLoading}>
            {bioLoading
              ? <ActivityIndicator color="#2F80ED" />
              : <Text style={styles.biometricBtnText}>🔒 تسجيل بالبصمة</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  loginBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    elevation: 6
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: '#F5F7FA'
  },
  logoImage: { width: '100%', height: '100%' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#111111' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#777', marginBottom: 20, marginTop: 4 },
  label: { fontSize: 13, color: '#444444', textAlign: 'right', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    fontSize: 15
  },
  button: {
    backgroundColor: '#2F80ED',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 22
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  biometricBtn: {
    borderWidth: 1,
    borderColor: '#2F80ED',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12
  },
  biometricBtnText: { color: '#2F80ED', fontSize: 15, fontWeight: 'bold' }
});
