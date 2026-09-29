import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useMealsStore } from '../../stores/mealsStore'

export default function TabsLayout() {
  const pendingCount = useMealsStore((s) => s.pendingCount)
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#16a34a' }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text> }} />
      <Tabs.Screen name="meals" options={{ title: 'Meals', tabBarBadge: pendingCount > 0 ? pendingCount : undefined, tabBarIcon: ({ color }) => <Text style={{ color }}>🍽️</Text> }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarIcon: ({ color }) => <Text style={{ color }}>📋</Text> }} />
      <Tabs.Screen name="chat" options={{ title: 'Coach', tabBarIcon: ({ color }) => <Text style={{ color }}>💬</Text> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Text style={{ color }}>⚙️</Text> }} />
    </Tabs>
  )
}
