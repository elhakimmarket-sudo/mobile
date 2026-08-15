import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import AppLockScreen from '../screens/AppLockScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import CheckInScreen from '../screens/CheckInScreen';
import MenuScreen from '../screens/MenuScreen';
import LoanScreen from '../screens/LoanScreen';
import LeaveScreen from '../screens/LeaveScreen';
import RewardsScreen from '../screens/RewardsScreen';
import PenaltiesScreen from '../screens/PenaltiesScreen';
import SalaryScreen from '../screens/SalaryScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
import EditProfilePhotoScreen from '../screens/EditProfilePhotoScreen';
import KioskHomeScreen from '../screens/KioskHomeScreen';
import KioskSearchScreen from '../screens/KioskSearchScreen';
import KioskConfirmScreen from '../screens/KioskConfirmScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();
const KioskStack = createNativeStackNavigator();

// ستاك مستقل تمامًا لوضع "يوزر المكتب" - مفيش تابات ولا قائمة عادية، بس شاشة رئيسية وبحث وتأكيد
function KioskStackNavigator() {
  return (
    <KioskStack.Navigator screenOptions={{ headerShown: false }}>
      <KioskStack.Screen name="KioskHome" component={KioskHomeScreen} />
      <KioskStack.Screen name="KioskSearch" component={KioskSearchScreen} options={{ headerShown: true, title: 'دوّر على اسمك' }} />
      <KioskStack.Screen name="KioskConfirm" component={KioskConfirmScreen} />
    </KioskStack.Navigator>
  );
}

// ستاك داخلي لتبويب "القائمة" - عشان تقدر تدخل من الليستة لصفحات فرعية (سلفة/إجازة/مكافآت/جزاءات/راتب)
// وترجع بزرار الرجوع العادي، من غير ما تتخانق مع باقي التابات
function MenuStackNavigator() {
  return (
    <MenuStack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <MenuStack.Screen name="MenuRoot" component={MenuScreen} options={{ title: 'القائمة' }} />
      <MenuStack.Screen name="Loan" component={LoanScreen} options={{ title: 'السلفة الشهرية' }} />
      <MenuStack.Screen name="Leave" component={LeaveScreen} options={{ title: 'طلب إجازة' }} />
      <MenuStack.Screen name="Rewards" component={RewardsScreen} options={{ title: 'المكافآت' }} />
      <MenuStack.Screen name="Penalties" component={PenaltiesScreen} options={{ title: 'الجزاءات' }} />
      <MenuStack.Screen name="Salary" component={SalaryScreen} options={{ title: 'الراتب' }} />
      <MenuStack.Screen name="Performance" component={PerformanceScreen} options={{ title: 'أدائي' }} />
      <MenuStack.Screen name="EditProfilePhoto" component={EditProfilePhotoScreen} options={{ headerShown: false }} />
    </MenuStack.Navigator>
  );
}

// ملحوظة: ترتيب التابات هنا هو اللي بيحدد مكانها على الشاشة في وضع RTL
// أول تاب بيتحط أقصى اليمين، وآخر تاب بيتحط أقصى الشمال
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="تسجيل"
      screenOptions={{
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#2F80ED',
        tabBarInactiveTintColor: '#999999'
      }}
    >
      <Tab.Screen
        name="لوحة المعلومات"
        component={DashboardScreen}
        options={{
          title: 'لوحة المعلومات',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />
        }}
      />
      <Tab.Screen
        name="تسجيل"
        component={HomeScreen}
        options={{
          title: 'تسجيل',
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle-outline" size={size} color={color} />
        }}
      />
      <Tab.Screen
        name="القائمة"
        component={MenuStackNavigator}
        options={{
          title: 'القائمة',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading, appLocked } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#111111" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : user.role === 'kiosk' ? (
          <Stack.Screen name="KioskMode" component={KioskStackNavigator} />
        ) : appLocked ? (
          <Stack.Screen name="AppLock" component={AppLockScreen} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="CheckIn"
              component={CheckInScreen}
              options={{ headerShown: true, title: 'تسجيل الحضور/الانصراف' }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ headerShown: true, title: 'الإشعارات', headerTitleAlign: 'center' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
