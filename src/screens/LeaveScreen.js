import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../services/api';

const typeLabels = {
  paid: 'إجازة مدفوعة',
  unpaid: 'إجازة غير مدفوعة'
};

const statusLabels = {
  pending: { text: 'قيد الانتظار', color: '#b46a00', bg: '#fff3e0' },
  approved: { text: 'تمت الموافقة', color: '#1e7e34', bg: '#e6f4ea' },
  rejected: { text: 'مرفوض', color: '#9c0c23', bg: '#fdecea' }
};

// بتحول Date لصيغة YYYY-MM-DD اللي السيرفر مستنيها
const formatDateYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function LeaveScreen() {
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState('paid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // بتفضل مضبوطة على النهاردة (الشهر والسنة الحاليين) لحد ما المستخدم يختار تاريخ تاني
  const [startDateObj, setStartDateObj] = useState(new Date());
  const [endDateObj, setEndDateObj] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const fetchData = async () => {
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        api.get('/leave/my'),
        api.get('/leave/balance')
      ]);
      setLeaves(leavesRes.data);
      setBalance(balanceRes.data);
    } catch (error) {
      console.log('خطأ في جلب طلبات الإجازة', error.message);
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
    setType('paid');
    const today = new Date();
    setStartDateObj(today);
    setEndDateObj(today);
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const onChangeStartDate = (event, selected) => {
    setShowStartPicker(Platform.OS === 'ios'); // في iOS التقويم بيفضل ظاهر لحد ما تدوسي تم
    if (selected) {
      setStartDateObj(selected);
      setStartDate(formatDateYMD(selected));
    }
  };

  const onChangeEndDate = (event, selected) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selected) {
      setEndDateObj(selected);
      setEndDate(formatDateYMD(selected));
    }
  };

  const submitLeave = async () => {
    if (!startDate || !endDate) {
      Alert.alert('تنبيه', 'من فضلك اختاري تاريخ البداية والنهاية');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/leave', { type, startDate, endDate, reason });
      Alert.alert('تم', 'تم إرسال طلب الإجازة بنجاح، في انتظار موافقة الإدارة');
      setModalVisible(false);
      resetForm();
      fetchData();
    } catch (error) {
      Alert.alert('خطأ', error.response?.data?.message || 'حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => {
    const st = statusLabels[item.status] || statusLabels.pending;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.typeText}>{typeLabels[item.type] || item.type}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>
        <Text style={styles.dateText}>من {item.startDate} إلى {item.endDate} ({item.daysCount} يوم)</Text>
        {!!item.reason && <Text style={styles.reasonText}>{item.reason}</Text>}
        {item.status === 'rejected' && !!item.reviewNote && (
          <Text style={styles.rejectNote}>سبب الرفض: {item.reviewNote}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={leaves}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          balance && (
            <View style={styles.balanceCard}>
              <Text style={styles.balanceValue}>{balance.remaining} يوم</Text>
              <Text style={styles.balanceLabel}>رصيدك المتبقي من الإجازة المدفوعة هذا الشهر (من أصل {balance.allowance})</Text>
            </View>
          )
        }
        ListEmptyComponent={<Text style={styles.empty}>لا يوجد طلبات إجازة بعد</Text>}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+ طلب إجازة</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>طلب إجازة جديد</Text>

            <Text style={styles.label}>نوع الإجازة</Text>
            <View style={styles.typeRow}>
              {Object.entries(typeLabels).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.typeChip, type === key && styles.typeChipActive]}
                  onPress={() => setType(key)}
                >
                  <Text style={[styles.typeChipText, type === key && styles.typeChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>تاريخ البداية</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
              <Text style={startDate ? styles.dateValueText : styles.datePlaceholderText}>
                {startDate || 'اختاري التاريخ'}
              </Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDateObj}
                mode="date"
                display="default"
                onChange={onChangeStartDate}
              />
            )}

            <Text style={styles.label}>تاريخ النهاية</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
              <Text style={endDate ? styles.dateValueText : styles.datePlaceholderText}>
                {endDate || 'اختاري التاريخ'}
              </Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDateObj}
                mode="date"
                display="default"
                onChange={onChangeEndDate}
              />
            )}

            <Text style={styles.label}>السبب (اختياري)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              placeholder="اكتب سبب الإجازة..."
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); resetForm(); }}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitLeave} disabled={submitting}>
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
  balanceCard: {
    backgroundColor: '#111111', borderRadius: 12, padding: 16,
    marginBottom: 14, alignItems: 'flex-end'
  },
  balanceValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  balanceLabel: { color: '#ccc', fontSize: 12, marginTop: 4, textAlign: 'right' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeText: { fontSize: 15, fontWeight: 'bold', color: '#111111' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dateText: { fontSize: 13, color: '#555', textAlign: 'right' },
  reasonText: { fontSize: 13, color: '#777', textAlign: 'right', marginTop: 6 },
  rejectNote: { fontSize: 12, color: '#9c0c23', textAlign: 'right', marginTop: 6 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },

  fab: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: '#C8102E', padding: 16, borderRadius: 30, alignItems: 'center', elevation: 4
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
  dateButton: {
    backgroundColor: '#F5F7FA', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#DDD', alignItems: 'flex-end'
  },
  dateValueText: { fontSize: 14, color: '#111111' },
  datePlaceholderText: { fontSize: 14, color: '#999' },
  typeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#DDD', marginBottom: 6, marginLeft: 6
  },
  typeChipActive: { backgroundColor: '#C8102E', borderColor: '#C8102E' },
  typeChipText: { fontSize: 13, color: '#555' },
  typeChipTextActive: { color: '#fff', fontWeight: '600' },

  modalActions: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20, gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#F5F7FA', alignItems: 'center' },
  cancelBtnText: { color: '#555' },
  submitBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#C8102E', alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold' }
});
