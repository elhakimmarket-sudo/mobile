import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, KeyboardAvoidingView,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../services/api';
import { COLORS, CARD_SHADOW, FIELD_SHADOW } from '../theme/colors';

const typeLabels = {
  paid: 'إجازة مدفوعة',
  unpaid: 'إجازة غير مدفوعة'
};

const statusLabels = {
  pending: { text: 'قيد الانتظار', color: COLORS.warningText, bg: COLORS.warningBg },
  approved: { text: 'تمت الموافقة', color: COLORS.successText, bg: COLORS.successBg },
  rejected: { text: 'مرفوض', color: COLORS.dangerText, bg: COLORS.dangerBg }
};

// بتحول Date لصيغة YYYY-MM-DD اللي السيرفر مستنيها
const formatDateYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function LeaveScreen() {
  const insets = useSafeAreaInsets();
  const [leaves, setLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState('paid');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [reasonFocused, setReasonFocused] = useState(false);

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
    setReasonFocused(false);
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
    resetForm();
  };

  const onChangeStartDate = (event, selected) => {
    setShowStartPicker(Platform.OS === 'ios'); // في iOS التقويم بيفضل ظاهر لحد ما تدوس تم
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
      Alert.alert('تنبيه', 'من فضلك اختار تاريخ البداية والنهاية');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('تنبيه', 'تاريخ النهاية لازم يكون بعد تاريخ البداية');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/leave', { type, startDate, endDate, reason });
      Alert.alert('تم', 'تم إرسال طلب الإجازة بنجاح، في انتظار موافقة الإدارة');
      closeModal();
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
              <Text style={styles.balanceLabel}>
                رصيدك المتبقي من الإجازة المدفوعة الشهر ده (من أصل {balance.allowance})
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="sunny-outline" size={30} color={COLORS.gray} />
            <Text style={styles.empty}>لسه مفيش طلبات إجازة</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
      />

      <TouchableOpacity style={[styles.fab, { bottom: 16 + insets.bottom }]} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={19} color={COLORS.white} />
        <Text style={styles.fabText}>طلب إجازة</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        {/* ⚠️ من غير KeyboardAvoidingView الكيبورد بيطلع فوق حقل السبب والزراير.
            النافذة ملزوقة في تحت فلازم ترتفع معاه بدل ما تفضل مكانها. */}
        {/* behavior على أندرويد: 'height' مش undefined.
            السبب: النافذة على أندرويد بتترسم في نافذة نظام منفصلة، وساعات مبتاخدش
            الـ adjustResize بتاع التطبيق. 'height' بيقيس الكيبورد بنفسه فبيشتغل في
            الحالتين. أسوأ حالة إنه يضغط النافذة شوية - والتمرير اللي جواها بيغطي ده،
            وده أرحم بكتير من إن الكيبورد يغطي الحقول تاني. */}
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeModal} />

          <View style={[styles.modalBox, { paddingBottom: 16 + insets.bottom }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>طلب إجازة جديد</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
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
                  {startDate || 'اختار التاريخ'}
                </Text>
                <Ionicons name="calendar-outline" size={17} color={COLORS.gray} />
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker value={startDateObj} mode="date" display="default" onChange={onChangeStartDate} />
              )}

              <Text style={styles.label}>تاريخ النهاية</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
                <Text style={endDate ? styles.dateValueText : styles.datePlaceholderText}>
                  {endDate || 'اختار التاريخ'}
                </Text>
                <Ionicons name="calendar-outline" size={17} color={COLORS.gray} />
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker value={endDateObj} mode="date" display="default" onChange={onChangeEndDate} />
              )}

              <Text style={styles.label}>السبب (اختياري)</Text>
              <View style={[styles.field, reasonFocused && styles.fieldFocused]}>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="اكتب سبب الإجازة..."
                  placeholderTextColor="#B6BDC9"
                  value={reason}
                  onChangeText={setReason}
                  onFocus={() => setReasonFocused(true)}
                  onBlur={() => setReasonFocused(false)}
                  multiline
                  textAlign="right"
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitLeave} disabled={submitting}>
                {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>إرسال الطلب</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  balanceCard: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 18,
    marginBottom: 14, alignItems: 'center'
  },
  balanceValue: { color: COLORS.white, fontSize: 26, fontWeight: '900' },
  balanceLabel: { color: '#DCE9FC', fontSize: 12.5, marginTop: 4, textAlign: 'center', lineHeight: 19 },

  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12, ...CARD_SHADOW },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeText: { fontSize: 15, fontWeight: 'bold', color: COLORS.black },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dateText: { fontSize: 13, color: COLORS.label, textAlign: 'right' },
  reasonText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'right', marginTop: 6 },
  rejectNote: { fontSize: 12, color: COLORS.dangerText, textAlign: 'right', marginTop: 6 },

  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  empty: { textAlign: 'center', color: COLORS.gray, fontSize: 14 },

  fab: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10
  },
  fabText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,41,0.5)' },

  modalBox: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%'
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D6DBE4', alignSelf: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'right', marginBottom: 18, color: COLORS.black },

  label: { fontSize: 12.5, fontWeight: '600', color: COLORS.label, textAlign: 'right', marginBottom: 7 },

  field: {
    backgroundColor: COLORS.white,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    marginBottom: 4,
    ...FIELD_SHADOW
  },
  fieldFocused: { borderColor: COLORS.primary },
  input: { paddingVertical: 13, fontSize: 15, color: COLORS.black },
  inputMultiline: { minHeight: 78, paddingTop: 13 },

  dateButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    ...FIELD_SHADOW
  },
  dateValueText: { fontSize: 15, color: COLORS.black },
  datePlaceholderText: { fontSize: 15, color: '#B6BDC9' },

  typeRow: { flexDirection: 'row-reverse', gap: 9, marginBottom: 16 },
  typeChip: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E2E7EF',
    backgroundColor: COLORS.white,
    alignItems: 'center'
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 13.5, color: COLORS.label, fontWeight: '600' },
  typeChipTextActive: { color: COLORS.white, fontWeight: '700' },

  modalActions: { flexDirection: 'row-reverse', marginTop: 16, gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 13, backgroundColor: COLORS.grayLight, alignItems: 'center' },
  cancelBtnText: { color: COLORS.label, fontWeight: '700', fontSize: 14.5 },
  submitBtn: { flex: 1.4, paddingVertical: 15, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  submitBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14.5 }
});
