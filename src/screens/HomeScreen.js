import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert, Vibration } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { scheduleBreakEndNotification, cancelBreakNotification } from '../services/breakNotifications';
import { COLORS, CARD_SHADOW } from '../theme/colors';

// نمط الاهتزاز وقت الإنذار - بيتكرر لحد ما يتلغي يدويًا بـ Vibration.cancel()
const ALARM_VIBRATION_PATTERN = [500, 1000, 500, 1000];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allowedBreakMinutes, setAllowedBreakMinutes] = useState(60);
  const [allowedBreakCount, setAllowedBreakCount] = useState(1);

  const [breakEndTime, setBreakEndTime] = useState(null); // Date
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [alarmRinging, setAlarmRinging] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // بتتحدث كل ثانية - بتُستخدم لعرض الساعة/التاريخ الحاليين ولحساب مدة العمل الحية
  const [now, setNow] = useState(new Date());

  const intervalRef = useRef(null);
  const clockIntervalRef = useRef(null);

  const fetchToday = async () => {
    try {
      const nowDate = new Date();
      const [attendanceRes, meRes, notificationsRes] = await Promise.all([
        api.get('/attendance/my', { params: { month: nowDate.getMonth() + 1, year: nowDate.getFullYear() } }),
        api.get('/auth/me'),
        api.get('/notifications/my').catch(() => ({ data: { unreadCount: 0 } }))
      ]);
      setUnreadCount(notificationsRes.data?.unreadCount || 0);

      // بتوقيت مصر (مش UTC) - عشان يتطابق مع تاريخ سجل الحضور المحسوب في الباك اند بالظبط
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowDate);
      const todayRecord = attendanceRes.data.find((r) => r.date === todayStr);
      setToday(todayRecord || null);

      const allowedMinutes = meRes.data?.allowedBreakMinutes || 60;
      setAllowedBreakMinutes(allowedMinutes);
      setAllowedBreakCount(meRes.data?.allowedBreakCount || 1);

      // لو فيه استراحة شغالة بالفعل (مثلاً المستخدم قفل وفتح التطبيق تاني)، أعد بناء العداد من بيانات السيرفر
      // - لازم نحسب الوقت المتبقي بعد خصم أي مرات راحة سابقة النهاردة، مش الوقت الكامل من الأول
      const openBreak = todayRecord?.breaks?.find((b) => !b.endTime);
      if (openBreak) {
        const usedMinutes = (todayRecord.breaks || []).reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
        const remainingMinutes = Math.max(0, allowedMinutes - usedMinutes);
        const endTime = new Date(new Date(openBreak.startTime).getTime() + remainingMinutes * 60000);
        setBreakEndTime(endTime);
        if (endTime.getTime() > Date.now()) {
          await scheduleBreakEndNotification(endTime);
        }
      } else {
        setBreakEndTime(null);
        setRemainingSeconds(null);
        setAlarmRinging(false);
        Vibration.cancel();
      }
    } catch (error) {
      console.log('خطأ في جلب بيانات اليوم', error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [])
  );

  // ساعة حية بتتحدث كل ثانية - بتُستخدم لعرض الوقت الحالي ولحساب مدة العمل والراحة
  useEffect(() => {
    clockIntervalRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockIntervalRef.current);
  }, []);

  // العداد التنازلي للراحة - بيتحدث كل ثانية طول ما فيه استراحة شغالة
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!breakEndTime) {
      setRemainingSeconds(null);
      return;
    }

    intervalRef.current = setInterval(() => {
      const diffSeconds = Math.round((breakEndTime.getTime() - Date.now()) / 1000);
      setRemainingSeconds(Math.max(0, diffSeconds));

      if (diffSeconds <= 0 && !alarmRinging) {
        setAlarmRinging(true);
        Vibration.vibrate(ALARM_VIBRATION_PATTERN, true); // true = يتكرر لحد ما يتلغي
      }
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakEndTime]);

  // إيقاف الاهتزاز لو الشاشة اتقفلت فجأة (احتياطي)
  useEffect(() => {
    return () => {
      Vibration.cancel();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchToday();
    setRefreshing(false);
  };

  const hasCheckedIn = today?.checkIn?.time;
  const hasCheckedOut = today?.checkOut?.time;
  const onBreak = today?.breaks?.some((b) => !b.endTime);

  // خلص كل مرات الراحة المسموحة، أو خلص إجمالي الوقت المسموح (حتى لو لسه فاضل مرات) - في الحالتين مينفعش يبدأ راحة تانية
  const todayBreaksCount = today?.breaks?.length || 0;
  const todayUsedBreakMinutes = (today?.breaks || []).reduce((sum, b) => sum + (b.durationMinutes || 0), 0);
  const breaksExhausted = !onBreak && (todayBreaksCount >= allowedBreakCount || todayUsedBreakMinutes >= allowedBreakMinutes);

  const handleBreak = async (action) => {
    try {
      const { data } = await api.post(`/attendance/break/${action}`);

      if (action === 'start') {
        const minutes = data.allowedBreakMinutes || allowedBreakMinutes || 60;
        const startTime = data.breakStartTime ? new Date(data.breakStartTime) : new Date();
        const endTime = new Date(startTime.getTime() + minutes * 60000);
        setBreakEndTime(endTime);
        setAlarmRinging(false);
        await scheduleBreakEndNotification(endTime);
      } else {
        // إنهاء الراحة - أوقف كل حاجة متعلقة بالتنبيه
        setBreakEndTime(null);
        setRemainingSeconds(null);
        setAlarmRinging(false);
        Vibration.cancel();
        await cancelBreakNotification();
      }

      Alert.alert('تم', data.message);
      fetchToday();
    } catch (error) {
      Alert.alert('خطأ', error.response?.data?.message || 'حدث خطأ');
    }
  };

  const formatCountdown = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // مدة العمل الفعلية من لحظة تسجيل الحضور لحد دلوقتي (بالساعة والدقيقة)
  const getWorkDuration = () => {
    if (!hasCheckedIn) return null;
    const checkInTime = new Date(today.checkIn.time);
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - checkInTime.getTime()) / 60000));
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return `${hours} س ${String(minutes).padStart(2, '0')} د`;
  };

  const currentDateStr = now.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
  // ساعة واضحة بأرقام عادية (مش هندية) + ص/م، عشان تبقى سهلة القراءة بسرعة
  const formatClock = (d) => {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    return { time: `${String(hours).padStart(2, '0')}:${minutes}`, period };
  };
  const currentClock = formatClock(now);
  const formatRecordTime = (dateValue) => {
    if (!dateValue) return null;
    const c = formatClock(new Date(dateValue));
    return `${c.time} ${c.period}`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ padding: 16 }}
    >
      <View style={styles.headerBlock}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.textMuted} />
            {unreadCount > 0 && (
              <View style={styles.bellDot}>
                <Text style={styles.bellDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>أهلاً، {user?.name}</Text>
        </View>
        <View style={styles.dateTimeCard}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={12} color="#cfe0fd" />
            <Text style={styles.dateTimeDate}>{currentDateStr}</Text>
          </View>
          <View style={styles.clockRow}>
            <Text style={styles.clockValue}>{currentClock.time}</Text>
            <Text style={styles.clockPeriod}>{currentClock.period}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>حالة اليوم</Text>
        <View style={styles.statusItemsRow}>
          <View style={styles.statusItem}>
            <View style={[styles.statusIconWrap, { backgroundColor: hasCheckedIn ? COLORS.successBg : COLORS.grayLight }]}>
              <Ionicons name="log-in-outline" size={17} color={hasCheckedIn ? COLORS.successText : COLORS.gray} />
            </View>
            <Text style={styles.statusItemLabel}>الحضور</Text>
            <Text style={styles.statusItemValue} numberOfLines={1}>
              {formatRecordTime(today?.checkIn?.time) || '—'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusIconWrap, { backgroundColor: hasCheckedOut ? COLORS.dangerBg : COLORS.grayLight }]}>
              <Ionicons name="log-out-outline" size={17} color={hasCheckedOut ? COLORS.dangerText : COLORS.gray} />
            </View>
            <Text style={styles.statusItemLabel}>الانصراف</Text>
            <Text style={styles.statusItemValue} numberOfLines={1}>
              {formatRecordTime(today?.checkOut?.time) || '—'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusIconWrap, { backgroundColor: onBreak ? COLORS.warningBg : COLORS.grayLight }]}>
              <Ionicons name="cafe-outline" size={17} color={onBreak ? COLORS.warningText : COLORS.gray} />
            </View>
            <Text style={styles.statusItemLabel}>الراحة</Text>
            <Text style={styles.statusItemValue} numberOfLines={1}>
              {onBreak ? 'شغالة الآن' : 'مفيش'}
            </Text>
          </View>
        </View>
      </View>

      {hasCheckedIn && !hasCheckedOut && (
        <View style={styles.workTimerCard}>
          <View style={styles.workTimerLabelRow}>
            <Ionicons name="time-outline" size={13} color="#e8f0fe" />
            <Text style={styles.workTimerLabel}>مدة العمل حتى الآن</Text>
          </View>
          <Text style={styles.workTimerValue}>{getWorkDuration()}</Text>
        </View>
      )}

      {onBreak && remainingSeconds !== null && (
        <View style={[styles.breakTimerCard, alarmRinging && styles.breakTimerCardAlarm]}>
          {alarmRinging ? (
            <>
              <Ionicons name="alarm-outline" size={26} color="#fff" style={{ marginBottom: 6 }} />
              <Text style={styles.alarmTitle}>انتهت فترة الراحة</Text>
              <Text style={styles.alarmSubtitle}>من فضلك ارجع للعمل وأنهِ الراحة</Text>
            </>
          ) : (
            <>
              <Text style={styles.timerLabel}>الوقت المتبقي للراحة</Text>
              <Text style={styles.timerValue}>{formatCountdown(remainingSeconds)}</Text>
            </>
          )}
        </View>
      )}

      {!hasCheckedIn && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CheckIn', { mode: 'check-in' })}
        >
          <Ionicons name="log-in-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText} numberOfLines={1}>تسجيل الحضور</Text>
        </TouchableOpacity>
      )}

      {hasCheckedIn && !hasCheckedOut && (
        <>
          {!onBreak ? (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('CheckIn', { mode: 'check-out' })}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText} numberOfLines={1}>تسجيل الانصراف</Text>
              </TouchableOpacity>
              {breaksExhausted ? (
                <View style={[styles.secondaryButton, styles.secondaryButtonDisabled]}>
                  <Ionicons name="cafe-outline" size={16} color={COLORS.gray} />
                  <Text style={[styles.secondaryButtonText, { color: COLORS.gray }]} numberOfLines={1}>
                    خلصت الراحة النهاردة
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => handleBreak('start')}>
                  <Ionicons name="cafe-outline" size={16} color={COLORS.black} />
                  <Text style={styles.secondaryButtonText} numberOfLines={1}>
                    بدء الراحة{allowedBreakCount > 1 ? ` (${todayBreaksCount}/${allowedBreakCount})` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, alarmRinging && styles.primaryButtonAlarm]}
                onPress={() => handleBreak('end')}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText} numberOfLines={1}>إنهاء الراحة</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('CheckIn', { mode: 'check-out' })}
              >
                <Ionicons name="log-out-outline" size={16} color={COLORS.black} />
                <Text style={styles.secondaryButtonText} numberOfLines={1}>تسجيل الانصراف</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {hasCheckedOut && (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-done-circle-outline" size={22} color={COLORS.successText} />
          <Text style={styles.doneText}>تم تسجيل يوم العمل بنجاح، أراك غدًا</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  headerBlock: { alignItems: 'flex-end', marginBottom: 16 },
  headerTopRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', marginBottom: 10
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.black, textAlign: 'right' },
  bellBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border
  },
  bellDot: {
    position: 'absolute', top: -4, left: -4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.dangerText, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3
  },
  bellDotText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  dateTimeCard: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    width: '100%', alignItems: 'center'
  },
  dateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 4 },
  dateTimeDate: { color: '#e8f0fe', fontSize: 13 },
  clockRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4 },
  clockValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 1 },
  clockPeriod: { color: '#fff', fontSize: 15, marginBottom: 4 },

  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    ...CARD_SHADOW
  },
  statusTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 14, textAlign: 'right', color: COLORS.black },
  statusItemsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  statusItem: { alignItems: 'center', flex: 1 },
  statusIconWrap: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6
  },
  statusItemLabel: { fontSize: 12, color: COLORS.gray, marginBottom: 3 },
  statusItemValue: { fontSize: 13, fontWeight: '600', color: COLORS.black },

  workTimerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center'
  },
  workTimerLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 6 },
  workTimerLabel: { color: '#e8f0fe', fontSize: 13 },
  workTimerValue: { color: '#fff', fontSize: 30, fontWeight: 'bold' },

  breakTimerCard: {
    backgroundColor: COLORS.black,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center'
  },
  breakTimerCardAlarm: {
    backgroundColor: COLORS.dangerText
  },
  timerLabel: { color: '#ccc', fontSize: 13, marginBottom: 6 },
  timerValue: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  alarmTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  alarmSubtitle: { color: '#fff', fontSize: 14 },

  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10
  },
  primaryButtonAlarm: {
    backgroundColor: COLORS.dangerText
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10
  },
  secondaryButtonText: { color: COLORS.black, fontSize: 14, fontWeight: '600' },
  secondaryButtonDisabled: { backgroundColor: COLORS.grayLight, borderColor: COLORS.grayLight },

  doneCard: { padding: 20, alignItems: 'center', gap: 6 },
  doneText: { fontSize: 15, color: COLORS.successText, textAlign: 'center' }
});
