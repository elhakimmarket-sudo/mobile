import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

const statusLabels = {
  present: '✅ حاضر',
  late: '⏰ متأخر',
  absent: '❌ غائب',
  on_leave: '🌴 إجازة',
  in_progress: '🔵 جاري العمل'
};

export default function HistoryScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    const now = new Date();
    try {
      const { data } = await api.get('/attendance/my', {
        params: { month: now.getMonth() + 1, year: now.getFullYear() }
      });
      setRecords(data);
    } catch (error) {
      console.log('خطأ في جلب السجل', error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.status}>{statusLabels[item.status] || item.status}</Text>
        <Text style={styles.date}>{item.date}</Text>
      </View>
      <Text style={styles.row}>
        دخول: {item.checkIn?.time ? new Date(item.checkIn.time).toLocaleTimeString('ar-EG') : '-'}
        {'   '}
        خروج: {item.checkOut?.time ? new Date(item.checkOut.time).toLocaleTimeString('ar-EG') : '-'}
      </Text>
      <Text style={styles.row}>
        ساعات العمل: {(item.totalWorkMinutes / 60).toFixed(1)} س
        {'   '}
        أوفر تايم: {(item.overtimeMinutes / 60).toFixed(1)} س
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={records}
      keyExtractor={(item) => item._id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.empty}>لا يوجد سجلات لهذا الشهر</Text>}
      contentContainerStyle={{ padding: 16 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 },
  status: { fontSize: 15, fontWeight: 'bold', color: '#111111' },
  date: { fontSize: 13, color: '#888' },
  row: { fontSize: 13, color: '#555', textAlign: 'right', marginTop: 4 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 }
});
