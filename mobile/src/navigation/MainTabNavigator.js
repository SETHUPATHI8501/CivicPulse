import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard,
  PlusCircle,
  Search,
  Shield,
  Flame,
  Settings,
  Siren,
} from 'lucide-react-native';
import colors from '../theme/colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

import CitizenDashboardScreen from '../screens/CitizenDashboardScreen';
import ReportComplaintScreen from '../screens/ReportComplaintScreen';
import TrackComplaintScreen from '../screens/TrackComplaintScreen';
import CivicHubScreen from '../screens/CivicHubScreen';
import OfficerDashboardScreen from '../screens/OfficerDashboardScreen';
import AdminAnalyticsScreen from '../screens/AdminAnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export const MainTabNavigator = () => {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: colors.slate400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={CitizenDashboardScreen}
        options={{
          tabBarLabel: t('home'),
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Report"
        component={ReportComplaintScreen}
        options={{
          tabBarLabel: t('reportIssue'),
          tabBarIcon: ({ color, size }) => (
            <PlusCircle size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Track"
        component={TrackComplaintScreen}
        options={{
          tabBarLabel: t('trackStatus'),
          tabBarIcon: ({ color, size }) => (
            <Search size={size || 20} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CivicHub"
        component={CivicHubScreen}
        options={{
          tabBarLabel: 'SOS & AI',
          tabBarIcon: ({ color, size }) => (
            <Siren size={size || 20} color={color} />
          ),
        }}
      />
      {isAuthenticated && (
        <Tab.Screen
          name="OfficerQueue"
          component={OfficerDashboardScreen}
          options={{
            tabBarLabel: t('officerQueue'),
            tabBarIcon: ({ color, size }) => (
              <Shield size={size || 20} color={color} />
            ),
          }}
        />
      )}
      {isAuthenticated && (
        <Tab.Screen
          name="Hotspots"
          component={AdminAnalyticsScreen}
          options={{
            tabBarLabel: t('adminAnalytics'),
            tabBarIcon: ({ color, size }) => (
              <Flame size={size || 20} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('settings'),
          tabBarIcon: ({ color, size }) => (
            <Settings size={size || 20} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
