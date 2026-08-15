import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

// المراحل: select (اختيار حضور/انصراف) -> camera (التقاط صورة) -> password (تأكيد كلمة مرور الموظف)
export default function KioskConfirmScreen({ route, navigation }) {
  const { employee } = route.params;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [mode, setMode] = useState(null); // 'check-in' | 'check-out'
  const [phase, setPhase] = useState('select');
  const [photo, setPhoto] = useState(null);
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState(null); // { hasCheckedIn, hasCheckedOut }

  useEffect(() => {
    fetchEmployeeStatus();
  }, []);

  const fetchEmployeeStatus = async () => {
    setStatusLoading(true);
    try {
      const { data } = await api.get(`/kiosk/employee-status/${employee._id}`);
      setAttendanceStatus(data);
    } catch (e) {
      setAttendanceStatus({ hasCheckedIn: false, hasCheckedOut: false });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (phase === 'camera') {
      getLocation();
    }
  }, [phase]);

  const getLocation = async () => {
    setLocating(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('تنبيه', 'لازم تسمح بالوصول للموقع عشان تسجل الحضور');
      setLocating(false);
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    setLocating(false);
  };

  const startFlow = (selectedMode) => {
    setMode(selectedMode);
    setPhoto(null);
    setPassword('');
    setPhase('camera');
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.5 });
    setPhoto(result.uri);
  };

  const retake = () => setPhoto(null);

  const proceedToPassword = () => {
    if (!photo) {
      Alert.alert('تنبيه', 'لازم تلتقط صورة الأول');
      return;
    }
    if (!location) {
      Alert.alert('تنبيه', 'لسه بنحدد الموقع، حاول تاني بعد شوية');
      return;
    }
    setPhase('password');
  };

  const submit = async () => {
    if (!password) {
      Alert.alert('تنبيه', 'لازم تدخل كلمة مرورك عشان نتأكد إنك إنت');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('employeeId', employee._id);
      formData.append('password', password);
      formData.append('lat', String(location.lat));
      formData.append('lng', String(location.lng));
      formData.append('photo', {
        uri: photo,
        name: 'attendance.jpg',
        type: 'image/jpeg'
      });

      const endpoint = mode === 'check-in' ? '/kiosk/check-in' : '/kiosk/check-out';
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Alert.alert('تم', `${employee.name} - ${data.message}`, [
        { text: 'حسنًا', onPress: () => navigation.navigate('KioskHome') }
      ]);
    } catch (error) {
      const msg = error.response?.data?.message || 'حدث خطأ، حاول مرة أخرى';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------- مرحلة الاختيار ----------
  if (phase === 'select') {
    const alreadyDoneBoth = attendanceStatus && attendanceStatus.hasCheckedIn && attendanceStatus.hasCheckedOut;
    const shouldCheckOut = attendanceStatus && attendanceStatus.hasCheckedIn && !attendanceStatus.hasCheckedOut;

    return (
      <View style={styles.selectContainer}>
        <View style={styles.selectCard}>
          <Text style={styles.employeeName}>{employee.name}</Text>
          <Text style={styles.employeeMeta}>{employee.position || ''}</Text>
          <Text style={styles.shiftText}>
            {employee.shift ? `⏱️ ${employee.shift.name} (${employee.shift.startTime} - ${employee.shift.endTime})` : 'بدون وردية محددة'}
          </Text>
        </View>

        {statusLoading ? (
          <ActivityIndicator size="large" color="#2F80ED" style={{ marginVertical: 20 }} />
        ) : alreadyDoneBoth ? (
          <View style={styles.doneCard}>
            <Text style={styles.doneCardText}>✅ سجّلت حضورك وانصرافك النهاردة بالفعل</Text>
          </View>
        ) : shouldCheckOut ? (
          <TouchableOpacity style={styles.checkOutButton} onPress={() => startFlow('check-out')}>
            <Text style={styles.actionButtonText}>🚪 تسجيل انصراف</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.checkInButton} onPress={() => startFlow('check-in')}>
            <Text style={styles.actionButtonText}>✅ تسجيل حضور</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>مش أنا - رجوع للبحث</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------- مرحلة الكاميرا ----------
  if (phase === 'camera') {
    if (!permission) {
      return <View style={styles.center}><ActivityIndicator size="large" /></View>;
    }
    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.permText}>لازم تسمح باستخدام الكاميرا عشان تكمل</Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.actionButtonText}>السماح باستخدام الكاميرا</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.cameraHeader}>
          {mode === 'check-in' ? '📍 تسجيل حضور' : '📍 تسجيل انصراف'} - {employee.name}
        </Text>
        {locating && <Text style={styles.locationText}>⏳ جاري تحديد الموقع...</Text>}
        {!locating && location && <Text style={styles.locationText}>✅ تم تحديد الموقع</Text>}

        {!photo ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
        ) : (
          <Image source={{ uri: photo }} style={styles.camera} />
        )}

        <View style={[styles.cameraActions, { paddingBottom: 16 + insets.bottom }]}>
          {!photo ? (
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
              <Text style={styles.actionButtonText}>📸 التقاط صورة</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.secondaryButton} onPress={retake}>
                <Text style={styles.secondaryButtonText}>إعادة الالتقاط</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={proceedToPassword}>
                <Text style={styles.actionButtonText}>التالي</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ---------- مرحلة كلمة المرور ----------
  return (
    <View style={styles.passwordContainer}>
      <Text style={styles.passwordTitle}>أكّد هويتك يا {employee.name}</Text>
      <Text style={styles.passwordSubtitle}>اكتب كلمة مرورك الشخصية عشان نتأكد إنك إنت اللي بتسجل</Text>
      <TextInput
        style={styles.passwordInput}
        placeholder="كلمة المرور"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoFocus
      />
      <TouchableOpacity style={styles.confirmButton} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>تأكيد {mode === 'check-in' ? 'الحضور' : 'الانصراف'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => setPhase('camera')}>
        <Text style={styles.backLinkText}>رجوع</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  selectContainer: { flex: 1, backgroundColor: '#F5F7FA', padding: 20, justifyContent: 'center' },
  selectCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 30, elevation: 1 },
  employeeName: { fontSize: 24, fontWeight: 'bold', color: '#111111', textAlign: 'center' },
  employeeMeta: { fontSize: 14, color: '#777', textAlign: 'center', marginTop: 4 },
  shiftText: { fontSize: 15, color: '#2F80ED', textAlign: 'center', marginTop: 12, fontWeight: '600' },
  checkInButton: { backgroundColor: '#2E7D32', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  checkOutButton: { backgroundColor: '#B71C1C', padding: 18, borderRadius: 12, alignItems: 'center' },
  doneCard: { backgroundColor: '#e6f4ea', borderRadius: 12, padding: 20, alignItems: 'center' },
  doneCardText: { color: '#1e7e34', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  actionButtonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  backLink: { marginTop: 24, alignItems: 'center' },
  backLinkText: { color: '#999', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permText: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  permButton: { backgroundColor: '#2F80ED', padding: 14, borderRadius: 10 },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraHeader: {
    color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center',
    paddingVertical: 14, backgroundColor: '#111111'
  },
  locationText: { color: '#fff', textAlign: 'center', paddingBottom: 8, backgroundColor: '#111111' },
  camera: { flex: 1 },
  cameraActions: { padding: 16, backgroundColor: '#111' },
  captureButton: { backgroundColor: '#111111', padding: 16, borderRadius: 10, alignItems: 'center' },
  confirmButton: { backgroundColor: '#2E7D32', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  secondaryButton: { backgroundColor: '#555', padding: 14, borderRadius: 10, alignItems: 'center' },
  secondaryButtonText: { color: '#fff', fontSize: 15 },
  passwordContainer: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  passwordTitle: { fontSize: 20, fontWeight: 'bold', color: '#111111', textAlign: 'center', marginBottom: 8 },
  passwordSubtitle: { fontSize: 14, color: '#777', textAlign: 'center', marginBottom: 24 },
  passwordInput: {
    borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 10, padding: 14,
    fontSize: 16, textAlign: 'right', marginBottom: 16
  }
});
