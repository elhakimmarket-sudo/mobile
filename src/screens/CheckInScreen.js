import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import api from '../services/api';

// mode: 'check-in' أو 'check-out'
export default function CheckInScreen({ route, navigation }) {
  const { mode } = route.params; // 'check-in' | 'check-out'
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    getLocation();
  }, []);

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

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.5 });
    setPhoto(result.uri);
  };

  const retake = () => setPhoto(null);

  const submit = async () => {
    if (!photo) {
      Alert.alert('تنبيه', 'لازم تلتقط صورة الأول');
      return;
    }
    if (!location) {
      Alert.alert('تنبيه', 'لسه بنحدد موقعك، حاول تاني بعد شوية');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('lat', String(location.lat));
      formData.append('lng', String(location.lng));
      formData.append('photo', {
        uri: photo,
        name: 'attendance.jpg',
        type: 'image/jpeg'
      });

      const endpoint = mode === 'check-in' ? '/attendance/check-in' : '/attendance/check-out';
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Alert.alert('تم', data.message, [
        { text: 'حسنًا', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      const msg = error.response?.data?.message || 'حدث خطأ، حاول مرة أخرى';
      Alert.alert('خطأ', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>لازم تسمح باستخدام الكاميرا عشان تكمل</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>السماح باستخدام الكاميرا</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {mode === 'check-in' ? '📍 تسجيل الحضور' : '📍 تسجيل الانصراف'}
      </Text>

      {locating && <Text style={styles.locationText}>⏳ جاري تحديد موقعك...</Text>}
      {!locating && location && <Text style={styles.locationText}>✅ تم تحديد موقعك</Text>}

      {!photo ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      ) : (
        <Image source={{ uri: photo }} style={styles.camera} />
      )}

      <View style={styles.actions}>
        {!photo ? (
          <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
            <Text style={styles.buttonText}>📸 التقاط صورة</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={retake}>
              <Text style={styles.secondaryButtonText}>إعادة الالتقاط</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>تأكيد {mode === 'check-in' ? 'الحضور' : 'الانصراف'}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 14,
    backgroundColor: '#111111'
  },
  locationText: { color: '#fff', textAlign: 'center', paddingBottom: 8, backgroundColor: '#111111' },
  camera: { flex: 1 },
  actions: { padding: 16, backgroundColor: '#111' },
  captureButton: {
    backgroundColor: '#111111',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10
  },
  secondaryButton: {
    backgroundColor: '#555',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  secondaryButtonText: { color: '#fff', fontSize: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  permText: { fontSize: 15, textAlign: 'center', marginBottom: 16 }
});
