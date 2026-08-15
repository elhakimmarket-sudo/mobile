import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
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
    { icon: '💰', label: 'الراتب', screen: 'Salary' },
    { icon: '📊', label: 'أدائي', screen: 'Performance' }
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.profileCard}>
        <TouchableOpacity style={styles.avatarWrap} onPress={() => navigation.navigate('EditProfilePhoto')}>
          {user?.profilePhotoUrl ? (
            <Image source={{ uri: user.profilePhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarPlaceholder}>👤</Text>
          )}
          <View style={styles.avatarEditBadge}><Text style={styles.avatarEditBadgeText}>✏️</Text></View>
        </TouchableOpacity>
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
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    elevation: 2, overflow: 'visible'
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { fontSize: 32 },
  avatarEditBadge: {
    position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#2F80ED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F5F7FA'
  },
  avatarEditBadgeText: { fontSize: 11 },
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
