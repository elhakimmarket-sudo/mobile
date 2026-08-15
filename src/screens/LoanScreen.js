import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';

const advanceStatusLabels = {
  pending: { text: 'قيد الانتظار', color: '#b46a00', bg: '#fff3e0' },
  approved: { text: 'موافق عليها', color: '#1e7e34', bg: '#e6f4ea' },
  rejected: { text: 'مرفوضة', color: '#9c0c23', bg: '#fdecea' }
};

const monthNames = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export default function LoanScreen() {
  const insets = useSafeAreaInsets();
  const [advances, setAdvances] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const fetchData = async () => {
    try {
      const { data } = await api.get('/advance/my');
      setAdvances(data);
    } catch (error) {
      console.log('خطأ في جلب طلبات السلف', error.message);
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

  const resetForm = () => {
    setAmount('');
    setReason('');
  };

  const submitAdvance = async () => {
    if (!amount) {
      Alert.alert('تنبيه', 'من فضلك أدخل مبلغ السلفة');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/advance', {
        amount: Number(amount),
        reason
      });
      Alert.alert('تم', data.message);
      setModalVisible(false);
      resetForm();
      fetchData();
    } catch (error) {
      // لو اترفض تلقائيًا بسبب الرصيد، السيرفر بيرجع الرسالة والسبب في نفس الوقت
      Alert.alert('تنبيه', error.response?.data?.message || 'حدث خطأ أثناء إرسال الطلب');
      setModalVisible(false);
      resetForm();
      fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {advances.length === 0 && <Text style={styles.empty}>لا يوجد طلبات سلف بعد</Text>}
        {advances.map((a) => {
          const st = advanceStatusLabels[a.status] || advanceStatusLabels.pending;
          return (
            <View key={a._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.amountText}>{a.amount} جنيه</Text>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
                </View>
              </View>
              <Text style={styles.detailText}>شهر {monthNames[a.month - 1]} {a.year}</Text>
              {!!a.reason && <Text style={styles.reasonText}>{a.reason}</Text>}
              {a.status === 'rejected' && !!a.reviewNote && (
                <Text style={styles.rejectNote}>{a.reviewNote}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ طلب سلفة</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: 20 + insets.bottom }]}>
            <Text style={styles.modalTitle}>طلب سلفة جديدة</Text>

            <Text style={styles.label}>المبلغ المطلوب (جنيه)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="1000" />

            <Text style={styles.label}>السبب (اختياري)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={reason}
              onChangeText={setReason}
              multiline
              placeholder="اكتب سبب طلب السلفة..."
            />

            <Text style={styles.hintText}>هتتخصم بالكامل من راتب الشهر الحالي، وهتترفض تلقائيًا لو تجاوزت رصيدك المتاح.</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitAdvance} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>إرسال الطلب</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  amountText: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  detailText: { fontSize: 13, color: '#555', textAlign: 'right', marginTop: 2 },
  reasonText: { fontSize: 13, color: '#777', textAlign: 'right', marginTop: 6 },
  rejectNote: { fontSize: 12, color: '#9c0c23', textAlign: 'right', marginTop: 6 },
  empty: { textAlign: 'center', color: '#888', marginBottom: 16 },

  fab: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: '#2F80ED', padding: 16, borderRadius: 30, alignItems: 'center', elevation: 4
  },
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 16, color: '#111111' },
  label: { fontSize: 13, color: '#555', textAlign: 'right', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#DDD', textAlign: 'right', fontSize: 14
  },
  hintText: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 10 },
  modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20, gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#F5F7FA', alignItems: 'center' },
  cancelBtnText: { color: '#555' },
  submitBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2F80ED', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold' }
});
