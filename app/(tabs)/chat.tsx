import { useEffect, useRef, useState } from 'react'
import { View, FlatList, ActivityIndicator } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { History, MessageCircle, SquarePen } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'
import { useChatStore } from '../../stores/chatStore'
import { ChatMessage } from '../../components/chat/ChatMessage'
import { ChatInput } from '../../components/chat/ChatInput'
import { Heading, Text, EmptyState, IconButton } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

export default function ChatScreen() {
  const { user } = useAuthStore()
  const router = useRouter()
  const { messages, loading, error, sendMessage, loadHistory, conversationId, conversations, fetchConversations, startNewConversation } =
    useChatStore()
  const threadTitle = conversations.find((c) => c.id === conversationId)?.title
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList>(null)
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()

  useEffect(() => {
    if (!user) return
    loadHistory(user.id)
    fetchConversations(user.id)
  }, [user])

  const handleSend = async () => {
    if (!input.trim() || !user) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    if (useChatStore.getState().error) setInput(text)
    listRef.current?.scrollToEnd()
  }

  return (
    // keyboard-controller's padding mode works on Android edge-to-edge, where RN's
    // KeyboardAvoidingView leaves the input behind the keyboard.
    <View className="flex-1 bg-background">
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View className="px-5 pb-3 border-b border-border flex-row items-center gap-2" style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-1">
          <Heading level={3} uppercase>
            Coach
          </Heading>
          <Text variant="bodySm" muted numberOfLines={1}>
            {conversationId ? threadTitle ?? 'Your AI health coach' : 'New chat'}
          </Text>
        </View>
        {/* Disabled while a reply is on its way, so it can't land in a different thread. */}
        <IconButton icon={History} accessibilityLabel="Chat history" variant="ghost" disabled={loading} onPress={() => router.push('/coach/threads')} />
        <IconButton icon={SquarePen} accessibilityLabel="New chat" variant="ghost" disabled={loading} onPress={startNewConversation} />
      </View>

      {messages.length === 0 ? (
        <View className="flex-1">
          <EmptyState
            icon={MessageCircle}
            title="Say hello to your coach"
            description="You can log meals, check your goals, get suggestions, or just ask questions."
            className="flex-1"
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatMessage role={item.role} content={item.content} />}
          className="flex-1 px-4 pt-4"
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
        />
      )}

      {loading ? <ActivityIndicator className="py-2" color={colors.primary} /> : null}
      {error ? (
        <Text variant="caption" className="text-danger px-4 pb-1">
          {error}
        </Text>
      ) : null}
      <ChatInput value={input} onChangeText={setInput} onSend={handleSend} disabled={loading} />
    </KeyboardAvoidingView>
    </View>
  )
}
