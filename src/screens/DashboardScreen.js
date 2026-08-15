import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const initials = (name) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
};

const statusLabels = {
  present: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  on_leave: 'إجازة',
  in_progress: 'جاري العمل'
};

const statusColors = {
  present: { bg: '#e6f4ea', text: '#1e7e34' },
  late: { bg: '#fff3e0', text: '#b46a00' },
  absent: { bg: '#fdecea', text: '#9c0c23' },
  on_leave: { bg: '#e8f0fe', text: '#1a56db' },
  in_progress: { bg: '#e8f0fe', text: '#1a56db' }
};

const monthNames = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// وقت واضح بأرقام عادية (مش أرقام هندية) عشان يبقى سهل القراءة، مثلاً 08:15 ص
const formatTime = (dateValue) => {
  if (!dateValue) return '-';
  const d = new Date(dateValue);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
};

// تاريخ مفهوم زي "الجمعة، 1 أغسطس" بدل الصيغة الرقمية الخام
const formatFriendlyDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return `${dayNames[dateObj.getDay()]}، ${d} ${monthNames[m - 1]}`;
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [leaveDays, setLeaveDays] = useState(0);
  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const now = new Date();

  const fetchData = async () => {
    try {
      setPhotoFailed(false);
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
          {profile?.profilePhotoUrl && !photoFailed ? (
            <Image
              source={{ uri: profile.profilePhotoUrl }}
              style={styles.avatarImage}
              onError={() => setPhotoFailed(true)}
            />
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

      <Text style={styles.sectionTitle}>سجل الحضور والانصراف</Text>
      {records.length === 0 && <Text style={styles.empty}>لا يوجد سجلات لهذا الشهر</Text>}
      {records.map((item) => {
        const colors = statusColors[item.status] || statusColors.present;
        return (
          <View key={item._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
                <Text style={[styles.statusPillText, { color: colors.text }]}>
                  {statusLabels[item.status] || item.status}
                </Text>
              </View>
              <Text style={styles.date}>{formatFriendlyDate(item.date)}</Text>
            </View>

            <View style={styles.timesRow}>
              <View style={styles.timeBlock}>
                <View style={[styles.timeDot, { backgroundColor: '#1e7e34' }]} />
                <View>
                  <Text style={styles.timeLabel}>حضور</Text>
                  <Text style={styles.timeValue}>{formatTime(item.checkIn?.time)}</Text>
                </View>
              </View>
              <View style={styles.timeBlock}>
                <View style={[styles.timeDot, { backgroundColor: '#9c0c23' }]} />
                <View>
                  <Text style={styles.timeLabel}>انصراف</Text>
                  <Text style={styles.timeValue}>{formatTime(item.checkOut?.time)}</Text>
                </View>
              </View>
            </View>

            {item.status === 'late' && item.lateMinutes > 0 && (
              <Text style={styles.lateNote}>متأخر {item.lateMinutes} دقيقة</Text>
            )}
          </View>
        );
      })}
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
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: 'bold' },
  date: { fontSize: 12, color: '#888' },
  timesRow: { flexDirection: 'row-reverse', gap: 24 },
  timeBlock: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  timeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  timeLabel: { fontSize: 11, color: '#999', textAlign: 'right' },
  timeValue: { fontSize: 15, fontWeight: '600', color: '#111111', textAlign: 'right' },
  lateNote: { fontSize: 12, color: '#b46a00', textAlign: 'right', marginTop: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 10 }
});
