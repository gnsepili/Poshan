import { Tabs, useRouter } from 'expo-router'
import { Platform, View } from 'react-native'
import { Home, ClipboardList, Camera, MessageCircle, User } from 'lucide-react-native'
import { PressableScale } from '../../components/motion'
import { useThemeColors } from '../../lib/theme'

// Raised orange camera button in the middle of the tab bar.
function SnapButton() {
  const router = useRouter()
  const colors = useThemeColors()
  return (
    <View className="flex-1 items-center">
      <PressableScale
        onPress={() => router.push('/meal/new')}
        accessibilityRole="button"
        accessibilityLabel="Snap a meal"
        className="h-14 w-14 rounded-full items-center justify-center -mt-5"
        style={{ backgroundColor: colors.accent }}
      >
        <Camera size={26} color={colors.onAccent} />
      </PressableScale>
    </View>
  )
}

export default function TabsLayout() {
  const colors = useThemeColors()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 66,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        },
        tabBarLabelStyle: {
          fontFamily: 'Barlow_600SemiBold',
          fontSize: 12,
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
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="snap"
        options={{
          title: 'Snap',
          tabBarButton: () => <SnapButton />,
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 24} />,
        }}
      />
    </Tabs>
  )
}
