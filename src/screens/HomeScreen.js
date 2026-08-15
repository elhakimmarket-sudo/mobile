import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Alert, Vibration } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { scheduleBreakEndNotification, cancelBreakNotification } from '../services/breakNotifications';

// نمط الاهتزاز وقت الإنذار - بيتكرر لحد ما يتلغي يدويًا بـ Vibration.cancel()
const ALARM_VIBRATION_PATTERN = [500, 1000, 500, 1000];

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [allowedBreakMinutes, setAllowedBreakMinutes] = useState(60);

  const [breakEndTime, setBreakEndTime] = useState(null); // Date
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [alarmRinging, setAlarmRinging] = useState(false);

  // بتتحدث كل ثانية - بتُستخدم لعرض الساعة/التاريخ الحاليين ولحساب مدة العمل الحية
  const [now, setNow] = useState(new Date());

  const intervalRef = useRef(null);
  const clockIntervalRef = useRef(null);

  const fetchToday = async () => {
    try {
      const nowDate = new Date();
      const [attendanceRes, meRes] = await Promise.all([
        api.get('/attendance/my', { params: { month: nowDate.getMonth() + 1, year: nowDate.getFullYear() } }),
        api.get('/auth/me')
      ]);

      // بتوقيت مصر (مش UTC) - عشان يتطابق مع تاريخ سجل الحضور المحسوب في الباك اند بالظبط
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowDate);
      const todayRecord = attendanceRes.data.find((r) => r.date === todayStr);
      setToday(todayRecord || null);

      const allowedMinutes = meRes.data?.allowedBreakMinutes ?? 60;
      setAllowedBreakMinutes(allowedMinutes);

      // لو فيه استراحة شغالة بالفعل (مثلاً المستخدم قفل وفتح التطبيق تاني)، أعد بناء العداد من بيانات السيرفر
      const openBreak = todayRecord?.breaks?.find((b) => !b.endTime);
      if (openBreak) {
        const endTime = new Date(new Date(openBreak.startTime).getTime() + allowedMinutes * 60000);
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

  const handleBreak = async (action) => {
    try {
      const { data } = await api.post(`/attendance/break/${action}`);

      if (action === 'start') {
        const minutes = data.allowedBreakMinutes ?? allowedBreakMinutes;
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
        <Text style={styles.headerTitle}>أهلاً، {user?.name}</Text>
        <View style={styles.dateTimeCard}>
          <Text style={styles.dateTimeDate}>{currentDateStr}</Text>
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
            <View style={[styles.statusIconWrap, { backgroundColor: '#e6f4ea' }]}>
              <Text style={styles.statusIcon}>✅</Text>
            </View>
            <Text style={styles.statusItemLabel}>الحضور</Text>
            <Text style={styles.statusItemValue} numberOfLines={1}>
              {formatRecordTime(today?.checkIn?.time) || '—'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusIconWrap, { backgroundColor: '#fdecea' }]}>
              <Text style={styles.statusIcon}>🚪</Text>
            </View>
            <Text style={styles.statusItemLabel}>الانصراف</Text>
            <Text style={styles.statusItemValue} numberOfLines={1}>
              {formatRecordTime(today?.checkOut?.time) || '—'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusIconWrap, { backgroundColor: onBreak ? '#fff3e0' : '#f0f0f0' }]}>
              <Text style={styles.statusIcon}>☕</Text>
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
          <Text style={styles.workTimerLabel}>⏱️ مدة العمل حتى الآن</Text>
          <Text style={styles.workTimerValue}>{getWorkDuration()}</Text>
        </View>
      )}

      {onBreak && remainingSeconds !== null && (
        <View style={[styles.breakTimerCard, alarmRinging && styles.breakTimerCardAlarm]}>
          {alarmRinging ? (
            <>
              <Text style={styles.alarmTitle}>⏰ انتهت فترة الراحة!</Text>
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
          style={styles.mainButton}
          onPress={() => navigation.navigate('CheckIn', { mode: 'check-in' })}
        >
          <Text style={styles.mainButtonIcon}>✅</Text>
          <Text style={styles.mainButtonText} numberOfLines={1}>تسجيل الحضور</Text>
        </TouchableOpacity>
      )}

      {hasCheckedIn && !hasCheckedOut && (
        <>
          {!onBreak ? (
            <TouchableOpacity style={styles.breakButton} onPress={() => handleBreak('start')}>
              <Text style={styles.mainButtonIcon}>☕</Text>
              <Text style={styles.mainButtonText} numberOfLines={1}>بدء الراحة</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.breakButton, alarmRinging && styles.breakButtonAlarm]}
              onPress={() => handleBreak('end')}
            >
              <Text style={styles.mainButtonIcon}>🔙</Text>
              <Text style={styles.mainButtonText} numberOfLines={1}>إنهاء الراحة</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={() => navigation.navigate('CheckIn', { mode: 'check-out' })}
          >
            <Text style={styles.mainButtonIcon}>🚪</Text>
            <Text style={styles.mainButtonText} numberOfLines={1}>تسجيل الانصراف</Text>
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

  headerBlock: { alignItems: 'flex-end', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 10 },
  dateTimeCard: {
    backgroundColor: '#2F80ED', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    width: '100%', alignItems: 'center'
  },
  dateTimeDate: { color: '#e8f0fe', fontSize: 13, marginBottom: 4 },
  clockRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4 },
  clockValue: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 1 },
  clockPeriod: { color: '#fff', fontSize: 15, marginBottom: 4 },

  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2
  },
  statusTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 14, textAlign: 'right', color: '#111111' },
  statusItemsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  statusItem: { alignItems: 'center', flex: 1 },
  statusIconWrap: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6
  },
  statusIcon: { fontSize: 18 },
  statusItemLabel: { fontSize: 12, color: '#999', marginBottom: 3 },
  statusItemValue: { fontSize: 13, fontWeight: '600', color: '#111111' },

  workTimerCard: {
    backgroundColor: '#2F80ED',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    alignItems: 'center'
  },
  workTimerLabel: { color: '#e8f0fe', fontSize: 13, marginBottom: 6 },
  workTimerValue: { color: '#fff', fontSize: 30, fontWeight: 'bold' },

  breakTimerCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center'
  },
  breakTimerCardAlarm: {
    backgroundColor: '#B71C1C'
  },
  timerLabel: { color: '#ccc', fontSize: 13, marginBottom: 6 },
  timerValue: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  alarmTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  alarmSubtitle: { color: '#fff', fontSize: 14 },

  mainButton: {
    backgroundColor: '#2F80ED',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12
  },
  breakButton: {
    backgroundColor: '#2b2b2b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12
  },
  breakButtonAlarm: {
    backgroundColor: '#B71C1C'
  },
  checkoutButton: {
    backgroundColor: '#178a48',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12
  },
  mainButtonIcon: { fontSize: 17 },
  mainButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  doneCard: { padding: 20, alignItems: 'center' },
  doneText: { fontSize: 16, color: '#178a48', textAlign: 'center' }
});
