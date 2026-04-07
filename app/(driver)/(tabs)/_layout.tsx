import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DriverTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#71717a',
        tabBarStyle: {
          backgroundColor: '#09090b',
          borderTopWidth: 1,
          borderTopColor: '#18181b',
          height: 80,
          paddingTop: 12,
          paddingBottom: 28,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Nearby',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} color={color} size={24} />
          ),
        }}
      />
      {/* 
        The following screens are placeholders for now as requested.
        In a real app, these would be separate files in this directory.
      */}
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} color={color} size={24} />
          ),
          // href: null, // Disable for now if file doesn't exist
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={24} />
          ),
          // href: null, // Disable for now if file doesn't exist
        }}
      />
    </Tabs>
  );
}
