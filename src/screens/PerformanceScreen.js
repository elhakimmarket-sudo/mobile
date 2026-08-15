import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { COLORS, CARD_SHADOW } from '../theme/colors';

const arabicMonthShort = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const formatMonthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  return `${arabicMonthShort[month - 1].slice(0, 3)} ${String(year).slice(2)}`;
};

// عمود واحد في الرسم البياني - ارتفاعه نسبي لأعلى قيمة في الشهور المعروضة كلها
const Bar = ({ value, maxValue, color, label }) => {
  const heightPercent = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
  return (
    <View style={styles.barColumn}>
      <Text style={styles.barValue}>{value}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height: `${heightPercent}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barLabel}>{label}</Text>
    </View>
  );
};

// رسم بياني بسيط بأعمدة - مبني بعناصر View عادية بدون أي مكتبة رسم بياني خارجية،
// عشان يشتغل فورًا من غير ما نحتاج نثبت حزمة جديدة أو نعيد بناء التطبيق
const SimpleBarChart = ({ data, dataKey, color, title }) => {
  const maxValue = Math.max(1, ...data.map((d) => d[dataKey]));
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      <View style={styles.chartRow}>
        {data.map((d) => (
          <Bar key={d.month} value={d[dataKey]} maxValue={maxValue} color={color} label={formatMonthLabel(d.month)} />
        ))}
      </View>
    </View>
  );
};

const scoreLabels = { punctuality: 'الالتزام بالمواعيد', quality: 'جودة العمل', teamwork: 'العمل الجماعي', initiative: 'المبادرة' };

const ReviewCard = ({ review }) => (
  <View style={styles.reviewCard}>
    <View style={styles.reviewHeader}>
      <Text style={styles.reviewPeriod}>{review.period}</Text>
      <Text style={styles.reviewOverall}>{review.overallScore}/5</Text>
    </View>
    {Object.keys(scoreLabels).map((key) => (
      <View key={key} style={styles.reviewScoreRow}>
        <Text style={styles.reviewScoreLabel}>{scoreLabels[key]}</Text>
        <View style={{ flexDirection: 'row-reverse', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= review.scores[key] ? 'star' : 'star-outline'}
              size={13}
              color="#F5A623"
            />
          ))}
        </View>
      </View>
    ))}
    {!!review.comments && <Text style={styles.reviewComments}>{review.comments}</Text>}
    <Text style={styles.reviewReviewer}>بواسطة: {review.reviewer?.name || '-'}</Text>
  </View>
);

export default function PerformanceScreen() {
  const [summary, setSummary] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = async () => {
    try {
      const [summaryRes, reviewsRes] = await Promise.all([
        api.get('/attendance/my/summary', { params: { months: 6 } }),
        api.get('/performance-review/my')
      ]);
      setSummary(summaryRes.data);
      setReviews(reviewsRes.data);
    } catch (error) {
      console.log('خطأ في جلب ملخص الأداء', error.message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchSummary().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2F80ED" />
      </View>
    );
  }

  const totals = summary.reduce(
    (acc, m) => ({
      present: acc.present + m.presentDays,
      late: acc.late + m.lateDays,
      absent: acc.absent + m.absentDays,
      overtime: acc.overtime + m.overtimeHours
    }),
    { present: 0, late: 0, absent: 0, overtime: 0 }
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{totals.present}</Text>
          <Text style={styles.summaryLabel}>يوم حضور</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryValue, { color: '#B46A00' }]}>{totals.late}</Text>
          <Text style={styles.summaryLabel}>يوم تأخير</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryValue, { color: '#9C0C23' }]}>{totals.absent}</Text>
          <Text style={styles.summaryLabel}>غياب</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryValue, { color: '#2F80ED' }]}>{totals.overtime}</Text>
          <Text style={styles.summaryLabel}>ساعة أوفر تايم</Text>
        </View>
      </View>

      <SimpleBarChart data={summary} dataKey="presentDays" color="#2F9E44" title="أيام الحضور - آخر 6 شهور" />
      <SimpleBarChart data={summary} dataKey="lateDays" color="#B46A00" title="أيام التأخير - آخر 6 شهور" />
      <SimpleBarChart data={summary} dataKey="absentDays" color="#9C0C23" title="أيام الغياب بدون إذن - آخر 6 شهور" />
      <SimpleBarChart data={summary} dataKey="overtimeHours" color="#2F80ED" title="ساعات الأوفر تايم - آخر 6 شهور" />

      <Text style={styles.sectionTitle}>تقييمات الأداء</Text>
      {reviews.length === 0 ? (
        <Text style={styles.emptyReviews}>لسه معملتلكش أي تقييم أداء</Text>
      ) : (
        reviews.map((r) => <ReviewCard key={r._id} review={r} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },

  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 16 },
  summaryBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 3, ...CARD_SHADOW },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#111111' },
  summaryLabel: { fontSize: 11, color: '#777', marginTop: 4, textAlign: 'center' },

  chartCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, ...CARD_SHADOW },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#111111', marginBottom: 14, textAlign: 'right' },
  chartRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 11, color: '#555', marginBottom: 4 },
  barTrack: { width: 14, height: 70, backgroundColor: '#F0F0F0', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 7 },
  barLabel: { fontSize: 10, color: '#999', marginTop: 6 },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111111', marginTop: 8, marginBottom: 10, textAlign: 'right' },
  emptyReviews: { textAlign: 'center', color: '#999', paddingVertical: 20 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, ...CARD_SHADOW },
  reviewHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reviewPeriod: { fontSize: 15, fontWeight: 'bold', color: '#111111' },
  reviewOverall: { fontSize: 15, fontWeight: 'bold', color: '#2F80ED' },
  reviewScoreRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 4 },
  reviewScoreLabel: { fontSize: 12, color: '#555' },
  reviewScoreValue: { fontSize: 12 },
  reviewComments: { fontSize: 12, color: '#777', marginTop: 8, textAlign: 'right', lineHeight: 18 },
  reviewReviewer: { fontSize: 11, color: '#aaa', marginTop: 8, textAlign: 'left' }
});
