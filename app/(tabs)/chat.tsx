import { useEffect, useRef, useState } from 'react'
import { View, FlatList, ActivityIndicator } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MessageCircle } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { useChatStore } from '../../stores/chatStore'
import { ChatMessage } from '../../components/chat/ChatMessage'
import { ChatInput } from '../../components/chat/ChatInput'
import { Heading, Text, EmptyState } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

export default function ChatScreen() {
  const { user } = useAuthStore()
  const { messages, loading, error, sendMessage, loadHistory } = useChatStore()
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList>(null)
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()

  useEffect(() => {
    if (user) loadHistory(user.id)
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
      <View className="px-5 pb-3 border-b border-border" style={{ paddingTop: insets.top + 8 }}>
        <Heading level={3} uppercase>
          Coach
        </Heading>
        <Text variant="bodySm" muted>
          Your AI health coach
        </Text>
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
