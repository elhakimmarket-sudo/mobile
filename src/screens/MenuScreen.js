import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { COLORS, CARD_SHADOW } from '../theme/colors';

// مربع في الشبكة - أيقونة جوه بادج ملون فوق واسمه تحت، اتنين في الصف
const MenuTile = ({ icon, badgeBg, iconColor, label, onPress }) => (
  <TouchableOpacity style={styles.tile} onPress={onPress}>
    <View style={[styles.tileIconWrap, { backgroundColor: badgeBg }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={styles.tileLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function MenuScreen({ navigation }) {
  const { user, logout, updateUserFields } = useAuth();
  const [photoFailed, setPhotoFailed] = useState(false);

  // بيانات اليوزر المحفوظة محليًا (من وقت الدخول) ممكن تبقى قديمة لو صورته اتغيرت من admin-web
  // بعد كده - فبنجيب أحدث نسخة من السيرفر كل مرة الشاشة تتفتح، ونحدّث النسخة المحفوظة كمان
  useFocusEffect(
    useCallback(() => {
      setPhotoFailed(false);
      api.get('/auth/me')
        .then(({ data }) => updateUserFields(data))
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const items = [
    { icon: 'card-outline', badgeBg: COLORS.infoBg, iconColor: COLORS.infoText, label: 'سلفة شهرية', screen: 'Loan' },
    { icon: 'sunny-outline', badgeBg: COLORS.warningBg, iconColor: COLORS.warningText, label: 'طلب إجازة', screen: 'Leave' },
    { icon: 'gift-outline', badgeBg: COLORS.successBg, iconColor: COLORS.successText, label: 'المكافآت', screen: 'Rewards' },
    { icon: 'alert-circle-outline', badgeBg: COLORS.dangerBg, iconColor: COLORS.dangerText, label: 'الجزاءات', screen: 'Penalties' },
    { icon: 'cash-outline', badgeBg: COLORS.grayLight, iconColor: COLORS.black, label: 'الراتب', screen: 'Salary' },
    { icon: 'stats-chart-outline', badgeBg: COLORS.infoBg, iconColor: COLORS.infoText, label: 'أدائي', screen: 'Performance' }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.profileCard}>
        <TouchableOpacity style={styles.avatarWrap} onPress={() => navigation.navigate('EditProfilePhoto')}>
          {user?.profilePhotoUrl && !photoFailed ? (
            <Image
              source={{ uri: user.profilePhotoUrl }}
              style={styles.avatarImage}
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <Ionicons name="person-outline" size={30} color="#fff" />
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="pencil" size={11} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>{user?.position || 'موظف'}</Text>
      </View>

      <View style={styles.grid}>
        {items.map((item) => (
          <MenuTile
            key={item.screen}
            icon={item.icon}
            badgeBg={item.badgeBg}
            iconColor={item.iconColor}
            label={item.label}
            onPress={() => navigation.navigate(item.screen)}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={16} color="#B71C1C" />
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  profileCard: { marginBottom: 20, alignItems: 'center' },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    ...CARD_SHADOW, overflow: 'visible'
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarEditBadge: {
    position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.bg
  },
  profileName: { fontSize: 20, fontWeight: 'bold', color: COLORS.black },
  profileRole: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  // شبكة اتنين في الصف - بادج ملون فوق واسمه تحت
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    marginBottom: 14,
    ...CARD_SHADOW
  },
  tileIconWrap: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10
  },
  tileLabel: { fontSize: 14, color: COLORS.black, fontWeight: '600' },

  logoutButton: { marginTop: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, padding: 14 },
  logoutText: { color: '#B71C1C', fontSize: 15 }
});
