import { useEffect } from 'react'
import { Alert, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { MessageCircle, SquarePen, Trash2 } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useChatStore } from '../../stores/chatStore'
import { useThemeColors } from '../../lib/theme'
import { Screen, Text, Button, IconButton, EmptyState } from '../../components/ui'
import { FadeIn, PressableScale } from '../../components/motion'

function when(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000))
  if (days < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function confirmDelete(title: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`Delete "${title}"?`)) onConfirm()
    return
  }
  Alert.alert('Delete this chat?', `"${title}" and its messages will be removed.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}

// Coach chat threads: open, start new, delete.
export default function ThreadsScreen() {
  const router = useRouter()
  const colors = useThemeColors()
  const { user } = useAuthStore()
  const { conversations, conversationId, fetchConversations, openConversation, startNewConversation, deleteConversation, error } = useChatStore()

  useEffect(() => {
    if (user) fetchConversations(user.id)
  }, [user])

  const open = (id: string) => {
    openConversation(id)
    router.back()
  }

  return (
    <Screen
      back
      title="Chats"
      scroll
      footer={
        <Button
          label="New chat"
          icon={SquarePen}
          onPress={() => {
            startNewConversation()
            router.back()
          }}
        />
      }
    >
      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}
      {conversations.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No chats yet" description="Start a chat with your coach — it'll show up here." />
      ) : (
        <View className="gap-2.5">
          {conversations.map((c, i) => (
            <FadeIn key={c.id} index={i}>
              <View className="flex-row items-center gap-1">
                <View className="flex-1">
                  <PressableScale
                    onPress={() => open(c.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open chat: ${c.title}`}
                    className={`rounded-2xl px-4 py-3.5 ${c.id === conversationId ? 'bg-primary-soft' : 'bg-surface'}`}
                  >
                    <Text variant="label" numberOfLines={1}>{c.title}</Text>
                    <Text variant="caption" muted>{when(c.updated_at)}</Text>
                  </PressableScale>
                </View>
                <IconButton
                  icon={Trash2}
                  accessibilityLabel={`Delete chat: ${c.title}`}
                  variant="ghost"
                  onPress={() => confirmDelete(c.title, () => deleteConversation(c.id))}
                />
              </View>
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  )
}
