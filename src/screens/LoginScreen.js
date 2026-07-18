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
  Platform
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('تنبيه', 'من فضلك أدخل رقم الهاتف وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (error) {
      const msg = error.response?.data?.message || 'حدث خطأ أثناء تسجيل الدخول';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Elhakim HR System</Text>
      <Text style={styles.subtitle}>تسجيل الدخول</Text>

      <TextInput
        style={styles.input}
        placeholder="رقم الهاتف"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textAlign="right"
      />
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F7FA' },
  title: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#111111' },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#777', marginBottom: 30, marginTop: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDD',
    fontSize: 16
  },
  button: {
    backgroundColor: '#C8102E',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
