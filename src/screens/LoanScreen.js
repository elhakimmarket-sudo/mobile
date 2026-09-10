import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
  TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import api from '../services/api';
import { COLORS, CARD_SHADOW, FIELD_SHADOW } from '../theme/colors';

const advanceStatusLabels = {
  pending: { text: 'قيد الانتظار', color: COLORS.warningText, bg: COLORS.warningBg },
  approved: { text: 'موافق عليها', color: COLORS.successText, bg: COLORS.successBg },
  rejected: { text: 'مرفوضة', color: COLORS.dangerText, bg: COLORS.dangerBg }
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
  const [focused, setFocused] = useState(null);

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
    setFocused(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
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
      closeModal();
      fetchData();
    } catch (error) {
      // لو اترفض تلقائيًا بسبب الرصيد، السيرفر بيرجع الرسالة والسبب في نفس الوقت
      Alert.alert('تنبيه', error.response?.data?.message || 'حدث خطأ أثناء إرسال الطلب');
      closeModal();
      fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {advances.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="card-outline" size={30} color={COLORS.gray} />
            <Text style={styles.emptyText}>لسه مفيش طلبات سلف</Text>
          </View>
        )}

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

      <TouchableOpacity style={[styles.fab, { bottom: 16 + insets.bottom }]} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={19} color={COLORS.white} />
        <Text style={styles.fabText}>طلب سلفة</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        {/* ⚠️ من غير KeyboardAvoidingView الكيبورد بيطلع فوق الحقول والزراير والموظف
            مش شايف اللي بيكتبه. النافذة ملزوقة في تحت (justifyContent: flex-end)
            فلازم ترتفع مع الكيبورد بدل ما تفضل مكانها. */}
        {/* behavior على أندرويد: 'height' مش undefined.
            السبب: النافذة على أندرويد بتترسم في نافذة نظام منفصلة، وساعات مبتاخدش
            الـ adjustResize بتاع التطبيق. 'height' بيقيس الكيبورد بنفسه فبيشتغل في
            الحالتين. أسوأ حالة إنه يضغط النافذة شوية - والتمرير اللي جواها بيغطي ده،
            وده أرحم بكتير من إن الكيبورد يغطي الحقول تاني. */}
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* ضغطة على المساحة الغامقة بتقفل - سلوك متوقع في أي نافذة سفلية */}
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeModal} />

          <View style={[styles.modalBox, { paddingBottom: 16 + insets.bottom }]}>
            <View style={styles.grabber} />
            <Text style={styles.modalTitle}>طلب سلفة جديدة</Text>

            {/* التمرير هنا هو خط الدفاع التاني: على أندرويد بنعتمد على
                windowSoftInputMode، ولو المساحة فضلت ضيقة الموظف يقدر يمرّر للحقل */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.label}>المبلغ المطلوب (جنيه)</Text>
              <View style={[styles.field, focused === 'amount' && styles.fieldFocused]}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  onFocus={() => setFocused('amount')}
                  onBlur={() => setFocused(null)}
                  placeholder="1000"
                  placeholderTextColor="#B6BDC9"
                  textAlign="right"
                />
              </View>

              <Text style={styles.label}>السبب (اختياري)</Text>
              <View style={[styles.field, focused === 'reason' && styles.fieldFocused]}>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={reason}
                  onChangeText={setReason}
                  onFocus={() => setFocused('reason')}
                  onBlur={() => setFocused(null)}
                  multiline
                  placeholder="اكتب سبب طلب السلفة..."
                  placeholderTextColor="#B6BDC9"
                  textAlign="right"
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.hintBox}>
                <Ionicons name="information-circle-outline" size={15} color={COLORS.infoText} />
                <Text style={styles.hintText}>
                  هتتخصم بالكامل من راتب الشهر الحالي، وهتترفض تلقائيًا لو تجاوزت رصيدك المتاح.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitAdvance} disabled={submitting}>
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

  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12, ...CARD_SHADOW },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  amountText: { fontSize: 16, fontWeight: 'bold', color: COLORS.black },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  detailText: { fontSize: 13, color: COLORS.label, textAlign: 'right', marginTop: 2 },
  reasonText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'right', marginTop: 6 },
  rejectNote: { fontSize: 12, color: COLORS.dangerText, textAlign: 'right', marginTop: 6 },

  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { textAlign: 'center', color: COLORS.gray, fontSize: 14 },

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
  grabber: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D6DBE4',
    alignSelf: 'center',
    marginBottom: 14
  },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'right', marginBottom: 18, color: COLORS.black },

  label: { fontSize: 12.5, fontWeight: '600', color: COLORS.label, textAlign: 'right', marginBottom: 7 },

  field: {
    backgroundColor: COLORS.white,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    marginBottom: 16,
    ...FIELD_SHADOW
  },
  fieldFocused: { borderColor: COLORS.primary },
  input: { paddingVertical: 13, fontSize: 15, color: COLORS.black },
  inputMultiline: { minHeight: 78, paddingTop: 13 },

  hintBox: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.infoBg,
    borderRadius: 11,
    padding: 12,
    marginBottom: 4
  },
  hintText: { flex: 1, fontSize: 12, color: COLORS.infoText, textAlign: 'right', lineHeight: 19 },

  modalActions: { flexDirection: 'row-reverse', marginTop: 16, gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 13, backgroundColor: COLORS.grayLight, alignItems: 'center' },
  cancelBtnText: { color: COLORS.label, fontWeight: '700', fontSize: 14.5 },
  submitBtn: { flex: 1.4, paddingVertical: 15, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  submitBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14.5 }
});
