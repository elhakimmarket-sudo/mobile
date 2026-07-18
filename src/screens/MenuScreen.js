import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';

// مربع في الشبكة - أيقونة فوق واسمه تحت، اتنين في الصف
const MenuTile = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.tile} onPress={onPress}>
    <Text style={styles.tileIcon}>{icon}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function MenuScreen({ navigation }) {
  const { user, logout } = useAuth();

  const items = [
    { icon: '💳', label: 'سلفة شهرية', screen: 'Loan' },
    { icon: '🏖️', label: 'طلب إجازة', screen: 'Leave' },
    { icon: '🎁', label: 'المكافآت', screen: 'Rewards' },
    { icon: '⚖️', label: 'الجزاءات', screen: 'Penalties' },
    { icon: '💰', label: 'الراتب', screen: 'Salary' }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.profileCard}>
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileRole}>{user?.position || 'موظف'}</Text>
      </View>

      <View style={styles.grid}>
        {items.map((item) => (
          <MenuTile key={item.screen} icon={item.icon} label={item.label} onPress={() => navigation.navigate(item.screen)} />
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>تسجيل الخروج</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  profileCard: { marginBottom: 20, alignItems: 'flex-end' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#111111' },
  profileRole: { fontSize: 13, color: '#777', marginTop: 2 },

  // شبكة اتنين في الصف - أيقونة فوق واسمها تحت
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 1
  },
  tileIcon: { fontSize: 30, marginBottom: 10 },
  tileLabel: { fontSize: 14, color: '#111111', fontWeight: '600' },

  logoutButton: { marginTop: 10, alignItems: 'center', padding: 14 },
  logoutText: { color: '#B71C1C', fontSize: 15 }
});
