import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AppLockScreen() {
  const { unlockApp, unlockWithPassword, logout, user } = useAuth();
  const [authenticating, setAuthenticating] = useState(false);
  const [showPasswordMode, setShowPasswordMode] = useState(false);
  const [password, setPassword] = useState('');
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    tryUnlock();
  }, []);

  const tryUnlock = async () => {
    setAuthenticating(true);
    await unlockApp();
    setAuthenticating(false);
  };

  const submitPassword = async () => {
    if (!password) return;
    setErrorMsg('');
    setCheckingPassword(true);
    const result = await unlockWithPassword(password);
    setCheckingPassword(false);
    if (!result.success) {
      setErrorMsg(result.message || 'كلمة المرور غير صحيحة');
    } else {
      setPassword('');
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>التطبيق مقفول</Text>
      <Text style={styles.subtitle}>
        {user?.name ? `أكّد هويتك عشان تكمل يا ${user.name}` : 'أكّد هويتك عشان تكمل'}
      </Text>

      {!showPasswordMode ? (
        <>
          <TouchableOpacity style={styles.unlockBtn} onPress={tryUnlock} disabled={authenticating}>
            <Text style={styles.unlockBtnText}>{authenticating ? 'جاري التحقق...' : '🔓 فتح التطبيق'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowPasswordMode(true)}>
            <Text style={styles.altLink}>البصمة أو رمز الجهاز مش شغالة؟ افتح بكلمة المرور</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.passwordInput}
            placeholder="كلمة مرور حسابك"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
            autoFocus
          />
          {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

          <TouchableOpacity style={styles.unlockBtn} onPress={submitPassword} disabled={checkingPassword}>
            {checkingPassword ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.unlockBtnText}>فتح التطبيق</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setShowPasswordMode(false); setErrorMsg(''); setPassword(''); }}>
            <Text style={styles.altLink}>الرجوع لتأكيد البصمة</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutBtnText}>تسجيل خروج</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo: { width: 90, height: 90, borderRadius: 20, marginBottom: 24 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: '#ccc', fontSize: 14, marginBottom: 32, textAlign: 'center' },
  unlockBtn: { backgroundColor: '#2F80ED', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 30, marginBottom: 16, minWidth: 220, alignItems: 'center' },
  unlockBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  altLink: { color: '#8ab4f8', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  passwordInput: {
    backgroundColor: '#1c1c1c', color: '#fff', width: '100%', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, fontSize: 15, textAlign: 'right', marginBottom: 10
  },
  errorText: { color: '#ff6b6b', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  logoutBtn: { padding: 10, marginTop: 8 },
  logoutBtnText: { color: '#999', fontSize: 13 }
});
