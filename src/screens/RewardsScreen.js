import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { CARD_SHADOW } from '../theme/colors';

export default function RewardsScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const { data } = await api.get('/penalty-reward/my');
      setRecords((data || []).filter((r) => r.type === 'reward'));
    } catch (error) {
      console.log('خطأ في جلب المكافآت', error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.container}
      data={records}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.empty}>لا يوجد مكافآت مسجلة بعد</Text>}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.amountText}>+ {item.amount} جنيه</Text>
            <Text style={styles.monthText}>شهر {item.month}/{item.year}</Text>
          </View>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, ...CARD_SHADOW },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  amountText: { fontSize: 16, fontWeight: 'bold', color: '#1e7e34' },
  monthText: { fontSize: 12, color: '#888' },
  reasonText: { fontSize: 13, color: '#555', textAlign: 'right' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 }
});
