import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#16a34a' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text> }} />
      <Tabs.Screen name="chat" options={{ title: 'Coach', tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text> }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarIcon: ({ color }) => <Text style={{ color }}>🍽️</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color }}>⚙️</Text> }} />
    </Tabs>
  )
}
