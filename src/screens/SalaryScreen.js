import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

export default function SalaryScreen() {
  const [salary, setSalary] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const fetchSalary = async () => {
    try {
      setNotFound(false);
      const { data } = await api.get('/salary/my', {
        params: { month: now.getMonth() + 1, year: now.getFullYear() }
      });
      setSalary(data);
    } catch (error) {
      setSalary(null);
      setNotFound(true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSalary();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSalary();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>راتب شهر {monthNames[now.getMonth()]} {now.getFullYear()}</Text>

      {notFound && (
        <View style={styles.card}>
          <Text style={styles.emptyText}>لم يتم احتساب راتب هذا الشهر بعد</Text>
        </View>
      )}

      {salary && (
        <View style={styles.card}>
          <Row label="الراتب الأساسي" value={`${salary.baseSalary} جنيه`} />
          <Row label="ساعات العمل الفعلية" value={`${Math.round(salary.totalWorkedMinutes / 60)} ساعة`} />
          <Row label="ساعات الأوفر تايم" value={`${Math.round(salary.totalOvertimeMinutes / 60)} ساعة`} />
          <Row label="مقابل الأوفر تايم" value={`${salary.overtimePay} جنيه`} />
          <Row label="أيام الغياب" value={`${salary.absentDays} يوم`} />
          <Row label="الخصومات" value={`- ${salary.deductions} جنيه`} negative />
          <Row label="مكافآت" value={`+ ${salary.bonuses || 0} جنيه`} />
          <View style={styles.divider} />
          <Row label="صافي الراتب" value={`${salary.netSalary} جنيه`} bold />
          <Text style={styles.status}>
            {salary.paid ? '✅ تم صرف الراتب' : '⏳ لم يتم الصرف بعد'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const Row = ({ label, value, negative, bold }) => (
  <View style={styles.row}>
    <Text style={[styles.value, negative && styles.negative, bold && styles.bold]}>{value}</Text>
    <Text style={[styles.label, bold && styles.bold]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', padding: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#111111', textAlign: 'right', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  label: { fontSize: 15, color: '#555' },
  value: { fontSize: 15, color: '#111111', fontWeight: '600' },
  negative: { color: '#B71C1C' },
  bold: { fontSize: 17, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#DDD', marginVertical: 8 },
  status: { textAlign: 'center', marginTop: 14, fontSize: 15, color: '#555' },
  emptyText: { textAlign: 'center', color: '#777', fontSize: 15 }
});
