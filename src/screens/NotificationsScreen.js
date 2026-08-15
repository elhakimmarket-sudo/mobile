import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

// أيقونة مناسبة لكل نوع إشعار - لو النوع مش معروف بيرجع أيقونة جرس عامة
const typeIcons = {
  leave: 'sunny-outline',
  loan: 'card-outline',
  advance: 'wallet-outline',
  permission: 'time-outline',
  overtime: 'stopwatch-outline',
  'penalty-reward': 'gift-outline',
  'performance-review': 'stats-chart-outline',
  general: 'notifications-outline'
};

// وقت نسبي مبسط بالعربي (زي "من 5 دقايق"، "امبارح"، إلخ) عشان يبقى مفهوم بسرعة من غير تاريخ كامل
const formatRelativeTime = (dateValue) => {
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'دلوقتي';
  if (minutes < 60) return `من ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `من ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'امبارح';
  if (days < 7) return `من ${days} أيام`;
  return new Date(dateValue).toLocaleDateString('ar-EG');
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications/my');
      setNotifications(data.notifications || []);
    } catch (error) {
      console.log('خطأ في جلب الإشعارات', error.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markOneRead = async (item) => {
    if (item.read) return;
    setNotifications((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
    try {
      await api.put(`/notifications/${item._id}/read`);
    } catch (error) {
      // لو فشل الطلب، مش لازم نرجّع الحالة تاني - هيتصحح لوحده في أول تحديث جاي
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.put('/notifications/read-all');
    } catch (error) {
      // نفس الفكرة - هيتصحح تلقائيًا في أول فتح تاني للشاشة
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2F80ED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllRow} onPress={markAllRead}>
          <Text style={styles.markAllText}>تعليم الكل كمقروء ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>مفيش إشعارات لسه</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => markOneRead(item)}
          >
            <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
              <Ionicons name={typeIcons[item.type] || typeIcons.general} size={18} color={!item.read ? '#2F80ED' : '#999'} />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardText}>{item.body}</Text>
              <Text style={styles.cardTime}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  markAllRow: { padding: 12, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ececec' },
  markAllText: { color: '#2F80ED', fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3
  },
  cardUnread: { borderRightWidth: 3, borderRightColor: '#2F80ED' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center', marginLeft: 12
  },
  iconWrapUnread: { backgroundColor: '#E6F1FB' },
  cardBody: { flex: 1, alignItems: 'flex-end' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111', textAlign: 'right', marginBottom: 3 },
  cardText: { fontSize: 13, color: '#666', textAlign: 'right', marginBottom: 6 },
  cardTime: { fontSize: 11, color: '#aaa', textAlign: 'right' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2F80ED', marginTop: 4 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: '#999', fontSize: 13, marginTop: 10 }
});
