import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { COLORS } from './src/config/constants';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import FeedScreen from './src/screens/FeedScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import CommunityScreen from './src/screens/CommunityScreen';
import TournamentsScreen from './src/screens/TournamentsScreen';
import TournamentDetailScreen from './src/screens/TournamentDetailScreen';
import GovtOfficesScreen from './src/screens/GovtOfficesScreen';
import BazarScreen from './src/screens/BazarScreen';
import NewsScreen from './src/screens/NewsScreen';
import RishtaScreen from './src/screens/RishtaScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import WeatherScreen from './src/screens/WeatherScreen';
import VideoFeedScreen from './src/screens/VideoFeedScreen';
import BloodDonationScreen from './src/screens/BloodDonationScreen';
import AIChatbotScreen from './src/screens/AIChatbotScreen';
import DMChatScreen from './src/screens/DMChatScreen';
import DMListScreen from './src/screens/DMListScreen';
import OpenChatScreen from './src/screens/OpenChatScreen';
import HelplineScreen from './src/screens/HelplineScreen';
import DoctorsScreen from './src/screens/DoctorsScreen';
import JobsScreen from './src/screens/JobsScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import RestaurantDealsScreen from './src/screens/RestaurantDealsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator — 5 Tabs: Home, Marketplace, Explore, Community, Profile
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketplaceScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={24} color={color} />,
          tabBarLabel: 'Buy & Sell',
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={24} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Auth Flow Navigation
function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash || loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Tournaments" component={TournamentsScreen} />
          <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
          <Stack.Screen name="GovtOffices" component={GovtOfficesScreen} />
          <Stack.Screen name="Bazar" component={BazarScreen} />
          <Stack.Screen name="News & Articles" component={NewsScreen} />
          <Stack.Screen name="Rishta" component={RishtaScreen} />
          <Stack.Screen name="Weather" component={WeatherScreen} />
          <Stack.Screen name="VideoFeed" component={VideoFeedScreen} />
          <Stack.Screen name="BloodDonation" component={BloodDonationScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Feed" component={FeedScreen} />
          <Stack.Screen name="AIChatbot" component={AIChatbotScreen} />
          <Stack.Screen name="DMList" component={DMListScreen} />
          <Stack.Screen name="DMChat" component={DMChatScreen} />
          <Stack.Screen name="OpenChat" component={OpenChatScreen} />
          <Stack.Screen name="Helpline" component={HelplineScreen} />
          <Stack.Screen name="Doctors" component={DoctorsScreen} />
          <Stack.Screen name="Jobs" component={JobsScreen} />
          <Stack.Screen name="RestaurantDeals" component={RestaurantDealsScreen} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
