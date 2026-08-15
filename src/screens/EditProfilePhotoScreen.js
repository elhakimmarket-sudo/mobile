import React, { useState, useRef } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function EditProfilePhotoScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { updateUserFields, setAuthInProgress } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.6 });
    setPhoto(result.uri);
  };

  const retake = () => setPhoto(null);

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('تنبيه', 'لازم تسمح بالوصول لمعرض الصور');
      return;
    }
    try {
      // فتح المعرض الأصلي بياخد التطبيق للخلفية لحظة - لازم نحذّر نظام قفل التطبيق بالبصمة إن ده مش خروج حقيقي
      setAuthInProgress(true);
      // مسحنا خاصية القص التلقائي (allowsEditing) لأنها كانت بتسبب إغلاق مفاجئ للتطبيق على بعض الأجهزة -
      // الدائرة نفسها بتقص الصورة بصريًا لأي شكل، فمش محتاجين نقصها من هنا أصلًا
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('خطأ', 'حصلت مشكلة في فتح المعرض، حاول تاني');
    } finally {
      setAuthInProgress(false);
    }
  };

  const submit = async () => {
    if (!photo) {
      Alert.alert('تنبيه', 'لازم تلتقط صورة الأول');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', {
        uri: photo,
        name: 'profile.jpg',
        type: 'image/jpeg'
      });

      const { data } = await api.put('/employees/me/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await updateUserFields({ profilePhotoUrl: data.profilePhotoUrl });

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
      <Text style={styles.header}>📷 تحديث الصورة الشخصية</Text>

      {!photo ? (
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />
      ) : (
        <Image source={{ uri: photo }} style={styles.camera} />
      )}

      <View style={[styles.actions, { paddingBottom: 16 + insets.bottom }]}>
        {!photo ? (
          <>
            <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
              <Text style={styles.buttonText}>📸 التقاط صورة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={pickFromGallery}>
              <Text style={styles.secondaryButtonText}>🖼️ اختيار من المعرض</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.secondaryButton} onPress={retake}>
              <Text style={styles.secondaryButtonText}>إعادة الالتقاط</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>حفظ الصورة</Text>
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
  camera: { flex: 1 },
  actions: { padding: 16, backgroundColor: '#111' },
  captureButton: {
    backgroundColor: '#111111',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center'
  },
  button: {
    backgroundColor: '#2F80ED',
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
