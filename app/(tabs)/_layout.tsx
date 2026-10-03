import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import {
  Home,
  UtensilsCrossed,
  ClipboardList,
  MessageCircle,
  Settings,
} from 'lucide-react-native'
import { useMealsStore } from '../../stores/mealsStore'
import { useThemeColors } from '../../lib/theme'

export default function TabsLayout() {
  const pendingCount = useMealsStore((s) => s.pendingCount)
  const colors = useThemeColors()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontFamily: 'Barlow_600SemiBold',
          fontSize: 11,
        },
        tabBarItemStyle: { paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent },
          tabBarIcon: ({ color, size }) => <UtensilsCrossed color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size ?? 24} />,
        }}
      />
    </Tabs>
  )
}
