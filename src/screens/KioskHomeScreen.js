import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function KioskHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [checking, setChecking] = useState(false);

  const openExitModal = () => {
    setExitPassword('');
    setExitModalVisible(true);
  };

  const confirmExit = async () => {
    if (!exitPassword) return;
    setChecking(true);
    try {
      const { data } = await api.post('/kiosk/verify-password', { password: exitPassword });
      if (data.valid) {
        setExitModalVisible(false);
        await logout();
      } else {
        Alert.alert('خطأ', 'كلمة المرور غلط');
      }
    } catch (e) {
      Alert.alert('خطأ', 'حدث خطأ، حاول مرة أخرى');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.companyName}>الحكيم Market</Text>
        <Text style={styles.subtitle}>جهاز المكتب المشترك</Text>

        <TouchableOpacity style={styles.mainButton} onPress={() => navigation.navigate('KioskSearch')}>
          <Text style={styles.mainButtonText}>تسجيل حضور / انصراف</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.exitButton, { paddingBottom: 16 + insets.bottom }]} onPress={openExitModal}>
        <Text style={styles.exitButtonText}>تسجيل خروج من وضع المكتب</Text>
      </TouchableOpacity>

      <Modal visible={exitModalVisible} transparent animationType="fade" onRequestClose={() => setExitModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>الخروج من وضع المكتب</Text>
            <Text style={styles.modalSubtitle}>اكتب كلمة مرور يوزر المكتب للتأكيد</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="كلمة المرور"
              secureTextEntry
              value={exitPassword}
              onChangeText={setExitPassword}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setExitModalVisible(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmExit} disabled={checking}>
                <Text style={styles.modalConfirmText}>{checking ? '...' : 'تأكيد'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWrap: {
    width: 96, height: 96, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16, elevation: 3
  },
  logo: { width: 64, height: 64 },
  companyName: { fontSize: 24, fontWeight: 'bold', color: '#111111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#777', marginBottom: 40 },
  mainButton: {
    backgroundColor: '#2F80ED', paddingVertical: 22, paddingHorizontal: 40,
    borderRadius: 16, elevation: 2, width: '100%'
  },
  mainButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  exitButton: { alignItems: 'center', padding: 16 },
  exitButtonText: { color: '#999', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 14, padding: 20, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#777', textAlign: 'right', marginBottom: 14 },
  modalInput: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 8, padding: 12,
    fontSize: 15, textAlign: 'right', marginBottom: 16
  },
  modalActions: { flexDirection: 'row-reverse', gap: 10 },
  modalCancelBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#555', alignItems: 'center' },
  modalCancelText: { color: '#fff', fontSize: 14 },
  modalConfirmBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2E7D32', alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: 'bold' }
});
