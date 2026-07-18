import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// السيرفر بيحفظ الصور بمسار نسبي زي /uploads/xxx.jpg - محتاجين نحط الدومين قبله عشان يتعرض صح
const SERVER_ROOT = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');

const initials = (name) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
};

const statusLabels = {
  present: '✅ حاضر',
  late: '⏰ متأخر',
  absent: '❌ غائب',
  on_leave: '🌴 إجازة',
  in_progress: '🔵 جاري العمل'
};

const monthNames = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [leaveDays, setLeaveDays] = useState(0);
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();

  const fetchData = async () => {
    try {
      const [attendanceRes, leaveRes, meRes] = await Promise.all([
        api.get('/attendance/my', { params: { month: now.getMonth() + 1, year: now.getFullYear() } }),
        api.get('/leave/my'),
        api.get('/auth/me')
      ]);
      setRecords(attendanceRes.data || []);
      setProfile(meRes.data);

      // بنجمع أيام الإجازات المعتمدة اللي واقعة في الشهر الحالي
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const approvedThisMonth = (leaveRes.data || []).filter(
        (l) => l.status === 'approved' && (l.startDate.startsWith(monthPrefix) || l.endDate.startsWith(monthPrefix))
      );
      const totalLeaveDays = approvedThisMonth.reduce((sum, l) => sum + (l.daysCount || 0), 0);
      setLeaveDays(totalLeaveDays);
    } catch (error) {
      console.log('خطأ في جلب بيانات لوحة المعلومات', error.message);
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

  const presentDays = records.filter((r) => r.status === 'present' || r.status === 'late').length;

  // ملحوظة: ده رقم تقريبي (أيام الشهر اللي عدت لحد النهاردة ناقص أيام الحضور وأيام الإجازة)
  // لأن السيرفر مبيسجلش سجل "غياب" صريح لكل يوم، فبنحسبه تقديريًا على الجهاز
  const daysPassedInMonth = now.getDate();
  const absentDays = Math.max(0, daysPassedInMonth - presentDays - leaveDays);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {profile?.profilePhotoUrl ? (
            <Image source={{ uri: SERVER_ROOT + profile.profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{initials(profile?.name || user?.name)}</Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile?.name || user?.name}</Text>
          <Text style={styles.profileDetail}>{profile?.position || 'موظف'}</Text>
          {!!profile?.department && <Text style={styles.profileDetail}>{profile.department}</Text>}
        </View>
      </View>

      <Text style={styles.monthLabel}>إحصائيات شهر {monthNames[now.getMonth()]} {now.getFullYear()}</Text>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#e6f4ea' }]}>
          <Text style={[styles.statValue, { color: '#1e7e34' }]}>{presentDays}</Text>
          <Text style={styles.statLabel}>يوم حضور</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fdecea' }]}>
          <Text style={[styles.statValue, { color: '#9c0c23' }]}>{absentDays}</Text>
          <Text style={styles.statLabel}>يوم غياب</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fff3e0' }]}>
          <Text style={[styles.statValue, { color: '#b46a00' }]}>{leaveDays}</Text>
          <Text style={styles.statLabel}>يوم إجازة</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>📋 سجل الحضور والانصراف</Text>
      {records.length === 0 && <Text style={styles.empty}>لا يوجد سجلات لهذا الشهر</Text>}
      {records.map((item) => (
        <View key={item._id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.status}>{statusLabels[item.status] || item.status}</Text>
            <Text style={styles.date}>{item.date}</Text>
          </View>
          <Text style={styles.row}>
            دخول: {item.checkIn?.time ? new Date(item.checkIn.time).toLocaleTimeString('ar-EG') : '-'}
            {'   '}
            خروج: {item.checkOut?.time ? new Date(item.checkOut.time).toLocaleTimeString('ar-EG') : '-'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  profileCard: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 16, marginBottom: 16, elevation: 2
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
  },
  avatarImage: { width: 56, height: 56 },
  avatarInitials: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profileInfo: { marginRight: 14, alignItems: 'flex-end', flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#111111' },
  profileDetail: { fontSize: 13, color: '#777', marginTop: 3 },
  monthLabel: { fontSize: 13, color: '#777', textAlign: 'right', marginBottom: 16 },
  statsRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#555', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  status: { fontSize: 14, fontWeight: 'bold', color: '#111111' },
  date: { fontSize: 12, color: '#888' },
  row: { fontSize: 13, color: '#555', textAlign: 'right' },
  empty: { textAlign: 'center', color: '#888', marginTop: 10 }
});
