import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchToday = async () => {
    try {
      const now = new Date();
      const { data } = await api.get('/attendance/my', {
        params: { month: now.getMonth() + 1, year: now.getFullYear() }
      });
      const todayStr = now.toISOString().split('T')[0];
      const todayRecord = data.find((r) => r.date === todayStr);
      setToday(todayRecord || null);
    } catch (error) {
      console.log('خطأ في جلب بيانات اليوم', error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchToday();
    setRefreshing(false);
  };

  const hasCheckedIn = today?.checkIn?.time;
  const hasCheckedOut = today?.checkOut?.time;
  const onBreak = today?.breaks?.some((b) => !b.endTime);

  const handleBreak = async (action) => {
    try {
      const { data } = await api.post(`/attendance/break/${action}`);
      Alert.alert('تم', data.message);
      fetchToday();
    } catch (error) {
      Alert.alert('خطأ', error.response?.data?.message || 'حدث خطأ');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text style={styles.headerTitle}>أهلاً، {user?.name} 👋</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>حالة اليوم</Text>
        <Text style={styles.statusRow}>
          🕐 الحضور: {hasCheckedIn ? new Date(today.checkIn.time).toLocaleTimeString('ar-EG') : 'لم يسجل بعد'}
        </Text>
        <Text style={styles.statusRow}>
          🕐 الانصراف: {hasCheckedOut ? new Date(today.checkOut.time).toLocaleTimeString('ar-EG') : 'لم يسجل بعد'}
        </Text>
        <Text style={styles.statusRow}>☕ حالة الراحة: {onBreak ? 'في استراحة الآن' : 'غير موجود'}</Text>
      </View>

      {!hasCheckedIn && (
        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => navigation.navigate('CheckIn', { mode: 'check-in' })}
        >
          <Text style={styles.mainButtonText}>✅ تسجيل الحضور</Text>
        </TouchableOpacity>
      )}

      {hasCheckedIn && !hasCheckedOut && (
        <>
          {!onBreak ? (
            <TouchableOpacity style={styles.breakButton} onPress={() => handleBreak('start')}>
              <Text style={styles.mainButtonText}>☕ بدء الراحة</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.breakButton} onPress={() => handleBreak('end')}>
              <Text style={styles.mainButtonText}>🔙 إنهاء الراحة</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: '#B71C1C' }]}
            onPress={() => navigation.navigate('CheckIn', { mode: 'check-out' })}
          >
            <Text style={styles.mainButtonText}>🚪 تسجيل الانصراف</Text>
          </TouchableOpacity>
        </>
      )}

      {hasCheckedOut && (
        <View style={styles.doneCard}>
          <Text style={styles.doneText}>🎉 تم تسجيل يوم العمل بنجاح، أراك غدًا!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 16 },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2
  },
  statusTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'right', color: '#111111' },
  statusRow: { fontSize: 15, marginBottom: 6, textAlign: 'right', color: '#333' },
  mainButton: {
    backgroundColor: '#2E7D32',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  breakButton: {
    backgroundColor: '#2b2b2b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  doneCard: { padding: 20, alignItems: 'center' },
  doneText: { fontSize: 16, color: '#2E7D32', textAlign: 'center' }
});
