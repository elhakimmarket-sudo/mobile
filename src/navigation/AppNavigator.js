import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import CheckInScreen from '../screens/CheckInScreen';
import MenuScreen from '../screens/MenuScreen';
import LoanScreen from '../screens/LoanScreen';
import LeaveScreen from '../screens/LeaveScreen';
import RewardsScreen from '../screens/RewardsScreen';
import PenaltiesScreen from '../screens/PenaltiesScreen';
import SalaryScreen from '../screens/SalaryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MenuStack = createNativeStackNavigator();

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
    </MenuStack.Navigator>
  );
}

// ملحوظة: ترتيب التابات هنا هو اللي بيحدد مكانها على الشاشة في وضع RTL
// أول تاب بيتحط أقصى اليمين، وآخر تاب بيتحط أقصى الشمال
function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <Tab.Screen name="لوحة المعلومات" component={DashboardScreen} options={{ title: 'لوحة المعلومات' }} />
      <Tab.Screen name="تسجيل" component={HomeScreen} options={{ title: 'تسجيل' }} />
      <Tab.Screen name="القائمة" component={MenuStackNavigator} options={{ title: 'القائمة', headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

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
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="CheckIn"
              component={CheckInScreen}
              options={{ headerShown: true, title: 'تسجيل الحضور/الانصراف' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
