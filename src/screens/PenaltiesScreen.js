import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { CARD_SHADOW } from '../theme/colors';

export default function PenaltiesScreen() {
  const [records, setRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const { data } = await api.get('/penalty-reward/my');
      setRecords((data || []).filter((r) => r.type === 'penalty'));
    } catch (error) {
      console.log('خطأ في جلب الجزاءات', error.message);
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
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="checkmark-done-circle-outline" size={30} color="#ccc" />
          <Text style={styles.empty}>لا يوجد جزاءات مسجلة، الحمد لله</Text>
        </View>
      }
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.amountText}>- {item.amount} جنيه</Text>
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
  amountText: { fontSize: 16, fontWeight: 'bold', color: '#9c0c23' },
  monthText: { fontSize: 12, color: '#888' },
  reasonText: { fontSize: 13, color: '#555', textAlign: 'right' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', color: '#888' }
});
