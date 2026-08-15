import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS, CARD_SHADOW } from '../theme/colors';

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

const statusMeta = {
  present: { bg: COLORS.successBg, text: COLORS.successText, icon: 'checkmark-circle-outline' },
  late: { bg: COLORS.warningBg, text: COLORS.warningText, icon: 'time-outline' },
  absent: { bg: COLORS.dangerBg, text: COLORS.dangerText, icon: 'close-circle-outline' },
  on_leave: { bg: COLORS.infoBg, text: COLORS.infoText, icon: 'sunny-outline' },
  in_progress: { bg: COLORS.infoBg, text: COLORS.infoText, icon: 'ellipse-outline' }
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
  // لأن السيرفر مبيسجلش سجل "غياب" صريح لكل يوم، فبنحسبه تقديريًا على الجهاز.
  // بنبدأ العد من أول يوم شغل فعلي للموظف (joinDate) لو وقع في الشهر الحالي - عشان الأيام
  // اللي قبل ما يتعين مايتحسبوش غياب بدون إذن
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = `${monthPrefix}-${String(now.getDate()).padStart(2, '0')}`;
  const monthStartStr = `${monthPrefix}-01`;
  const joinDateStr = profile?.joinDate ? String(profile.joinDate).split('T')[0] : null;
  const effectiveStartStr = joinDateStr && joinDateStr > monthStartStr ? joinDateStr : monthStartStr;
  const daysPassedInMonth = Math.floor((new Date(todayStr) - new Date(effectiveStartStr)) / 86400000) + 1;
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
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.successBg }]}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.successText} />
          </View>
          <Text style={[styles.statValue, { color: COLORS.successText }]}>{presentDays}</Text>
          <Text style={styles.statLabel}>يوم حضور</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.dangerBg }]}>
            <Ionicons name="close-circle-outline" size={15} color={COLORS.dangerText} />
          </View>
          <Text style={[styles.statValue, { color: COLORS.dangerText }]}>{absentDays}</Text>
          <Text style={styles.statLabel}>يوم غياب</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.warningBg }]}>
            <Ionicons name="sunny-outline" size={15} color={COLORS.warningText} />
          </View>
          <Text style={[styles.statValue, { color: COLORS.warningText }]}>{leaveDays}</Text>
          <Text style={styles.statLabel}>يوم إجازة</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>سجل الحضور والانصراف</Text>
      {records.length === 0 && <Text style={styles.empty}>لا يوجد سجلات لهذا الشهر</Text>}
      {records.map((item) => {
        const meta = statusMeta[item.status] || statusMeta.present;
        return (
          <View key={item._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon} size={12} color={meta.text} />
                <Text style={[styles.statusPillText, { color: meta.text }]}>
                  {statusLabels[item.status] || item.status}
                </Text>
              </View>
              <Text style={styles.date}>{formatFriendlyDate(item.date)}</Text>
            </View>

            <View style={styles.timesRow}>
              <View style={styles.timeBlock}>
                <Ionicons name="log-in-outline" size={14} color={COLORS.successText} />
                <View>
                  <Text style={styles.timeLabel}>حضور</Text>
                  <Text style={styles.timeValue}>{formatTime(item.checkIn?.time)}</Text>
                </View>
              </View>
              <View style={styles.timeBlock}>
                <Ionicons name="log-out-outline" size={14} color={COLORS.dangerText} />
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  profileCard: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: 14, padding: 16, marginBottom: 16, ...CARD_SHADOW
  },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
  },
  avatarImage: { width: 56, height: 56 },
  avatarInitials: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  profileInfo: { marginRight: 14, alignItems: 'flex-end', flex: 1 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: COLORS.black },
  profileDetail: { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  monthLabel: { fontSize: 13, color: COLORS.textMuted, textAlign: 'right', marginBottom: 16 },
  statsRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, alignItems: 'center', ...CARD_SHADOW },
  statIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: '#555', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.black, textAlign: 'right', marginBottom: 10 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...CARD_SHADOW },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillText: { fontSize: 12, fontWeight: 'bold' },
  date: { fontSize: 12, color: '#888' },
  timesRow: { flexDirection: 'row-reverse', gap: 24 },
  timeBlock: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  timeLabel: { fontSize: 11, color: COLORS.gray, textAlign: 'right' },
  timeValue: { fontSize: 15, fontWeight: '600', color: COLORS.black, textAlign: 'right' },
  lateNote: { fontSize: 12, color: COLORS.warningText, textAlign: 'right', marginTop: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 10 }
});
