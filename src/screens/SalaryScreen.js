import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

export default function SalaryScreen() {
  const insets = useSafeAreaInsets();
  const [salary, setSalary] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingPreviousMonth, setViewingPreviousMonth] = useState(false);

  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownTitle, setBreakdownTitle] = useState('');
  const [breakdownRows, setBreakdownRows] = useState([]);
  const [breakdownTotal, setBreakdownTotal] = useState(0);

  const now = new Date();
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  // بيرجع الشهر/السنة المعروضين دلوقتي - الحالي أو السابق حسب اختيار الموظف
  const getViewedDate = () => {
    if (!viewingPreviousMonth) {
      return { month: now.getMonth() + 1, year: now.getFullYear() };
    }
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return { month: prevMonth, year: prevYear };
  };

  const fetchSalary = async () => {
    try {
      setNotFound(false);
      const { month, year } = getViewedDate();
      const { data } = await api.get('/salary/my', { params: { month, year } });
      setSalary(data);
    } catch (error) {
      setSalary(null);
      setNotFound(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSalary();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewingPreviousMonth])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalary();
    setRefreshing(false);
  };

  const openBreakdown = async (type, title) => {
    if (!salary?._id) return;
    setBreakdownTitle(title);
    setBreakdownVisible(true);
    setBreakdownLoading(true);
    setBreakdownRows([]);
    setBreakdownTotal(0);

    try {
      const { data } = await api.get(`/salary/${salary._id}/breakdown`);

      if (type === 'overtime') {
        const { days, hourlyRate, total } = data.overtime;
        setBreakdownRows(days.map((d) => ({
          label: `${d.date} (${d.hours} ساعة × ${hourlyRate} جنيه)`,
          value: Math.round(d.hours * hourlyRate * 100) / 100
        })));
        setBreakdownTotal(total);
      } else if (type === 'bonuses') {
        const { items, total } = data.bonuses;
        setBreakdownRows(items.map((b) => ({ label: b.reason || 'مكافأة', value: b.amount })));
        setBreakdownTotal(total);
      } else {
        const { penalties, lateness, loanInstallments, advances, total } = data.deductions;
        const rows = [
          ...penalties.map((p) => ({ label: `⚖️ ${p.reason || 'جزاء'}`, value: p.amount })),
          ...lateness.map((l) => ({ label: `⏰ تأخير ${l.date} (مرة ${l.occurrence})`, value: l.amount })),
          ...loanInstallments.map((i) => ({ label: `💳 قسط قرض مستحق ${i.dueDate}`, value: i.amount })),
          ...advances.map((a) => ({ label: `💰 سلفة${a.reason ? ' - ' + a.reason : ''}`, value: a.amount }))
        ];
        setBreakdownRows(rows);
        setBreakdownTotal(total);
      }
    } catch (error) {
      setBreakdownRows([]);
    } finally {
      setBreakdownLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>راتب شهر {monthNames[getViewedDate().month - 1]} {getViewedDate().year}</Text>

      <TouchableOpacity
        style={styles.toggleMonthButton}
        onPress={() => setViewingPreviousMonth((v) => !v)}
      >
        <Text style={styles.toggleMonthButtonText}>
          {viewingPreviousMonth ? '🔙 عرض الشهر الحالي' : '📅 عرض الشهر السابق'}
        </Text>
      </TouchableOpacity>

      {notFound && (
        <View style={styles.card}>
          <Text style={styles.emptyText}>لم يتم احتساب راتب هذا الشهر بعد</Text>
        </View>
      )}

      {salary && !salary.paid && (
        <View style={styles.card}>
          <Text style={styles.emptyText}>⏳ لسه راتب الشهر ده ما اتصرفش، هتقدر تشوف تفاصيله بعد ما يتم الصرف</Text>
        </View>
      )}

      {salary && salary.paid && (
        <View style={styles.card}>
          <Row label="الراتب الأساسي" value={`${salary.baseSalary} جنيه`} />
          <Row
            label="المكافآت"
            value={`+ ${salary.bonuses || 0} جنيه`}
            onInfoPress={() => openBreakdown('bonuses', 'تفاصيل المكافآت')}
          />
          <Row
            label="الأوفر تايم"
            value={`+ ${salary.overtimePay} جنيه`}
            onInfoPress={() => openBreakdown('overtime', 'تفاصيل الأوفر تايم')}
          />
          <Row
            label="الخصومات"
            value={`- ${salary.deductions} جنيه`}
            negative
            onInfoPress={() => openBreakdown('deductions', 'تفاصيل الخصومات')}
          />
          <View style={styles.divider} />
          <Row label="إجمالي الراتب" value={`${salary.netSalary} جنيه`} bold />
          <Text style={styles.status}>
            ✅ تم صرف الراتب
          </Text>
        </View>
      )}

      <Modal visible={breakdownVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 20 + insets.bottom }]}>
            <Text style={styles.modalTitle}>{breakdownTitle}</Text>

            {breakdownLoading ? (
              <ActivityIndicator size="large" color="#2F80ED" style={{ marginVertical: 30 }} />
            ) : breakdownRows.length === 0 ? (
              <Text style={styles.emptyBreakdownText}>لا يوجد تفاصيل مسجلة لهذا البند</Text>
            ) : (
              <>
                {breakdownRows.map((row, index) => (
                  <View key={index} style={styles.breakdownRow}>
                    <Text style={styles.breakdownValue}>{row.value} جنيه</Text>
                    <Text style={styles.breakdownLabel}>{row.label}</Text>
                  </View>
                ))}
                <View style={styles.breakdownTotalRow}>
                  <Text style={styles.breakdownTotalValue}>{breakdownTotal} جنيه</Text>
                  <Text style={styles.breakdownTotalLabel}>الإجمالي</Text>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => setBreakdownVisible(false)}>
              <Text style={styles.closeButtonText}>تمام</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const Row = ({ label, value, negative, bold, onInfoPress }) => (
  <View style={styles.row}>
    <View style={styles.valueWithInfo}>
      <Text style={[styles.value, negative && styles.negative, bold && styles.bold]}>{value}</Text>
      {onInfoPress && (
        <TouchableOpacity onPress={onInfoPress} style={styles.infoButton}>
          <Text style={styles.infoButtonText}>ⓘ</Text>
        </TouchableOpacity>
      )}
    </View>
    <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 16 },
  toggleMonthButton: {
    alignSelf: 'flex-end', backgroundColor: '#fff', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, elevation: 1
  },
  toggleMonthButtonText: { fontSize: 13, color: '#2F80ED', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  valueWithInfo: { flexDirection: 'row-reverse', alignItems: 'center' },
  infoButton: { marginLeft: 6, padding: 4 },
  infoButtonText: { fontSize: 14, color: '#999' },
  label: { fontSize: 15, color: '#555' },
  value: { fontSize: 15, color: '#111111', fontWeight: '600' },
  negative: { color: '#B71C1C' },
  bold: { fontSize: 17, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#DDD', marginVertical: 8 },
  status: { textAlign: 'center', marginTop: 14, fontSize: 15, color: '#555' },
  emptyText: { textAlign: 'center', color: '#777', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 16, color: '#111111' },
  emptyBreakdownText: { textAlign: 'center', color: '#999', paddingVertical: 30 },
  breakdownRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE'
  },
  breakdownLabel: { fontSize: 14, color: '#555', flex: 1, textAlign: 'right' },
  breakdownValue: { fontSize: 14, color: '#111111', fontWeight: '600', marginLeft: 10 },
  breakdownTotalRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    paddingVertical: 14, marginTop: 8, borderTopWidth: 2, borderTopColor: '#DDD'
  },
  breakdownTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  breakdownTotalValue: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  closeButton: { backgroundColor: '#2F80ED', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  closeButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' }
});
