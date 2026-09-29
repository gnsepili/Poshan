import { useEffect, useRef, useState } from 'react'
import { View, FlatList, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../../stores/authStore'
import { useChatStore } from '../../stores/chatStore'
import { ChatMessage } from '../../components/chat/ChatMessage'
import { ChatInput } from '../../components/chat/ChatInput'

export default function ChatScreen() {
  const { user } = useAuthStore()
  const { messages, loading, error, sendMessage, loadHistory } = useChatStore()
  const [input, setInput] = useState('')
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    if (user) loadHistory(user.id)
  }, [user])

  const handleSend = async () => {
    if (!input.trim() || !user) return
    const text = input.trim()
    setInput('')
    await sendMessage(user.id, text)
    if (useChatStore.getState().error) setInput(text)
    listRef.current?.scrollToEnd()
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Coach</Text>
        <Text className="text-gray-500 text-sm">Your AI health coach</Text>
      </View>
      {messages.length === 0 && (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-center">
            Say hello to your coach! You can log meals, check your goals, get suggestions, or just ask questions.
          </Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ChatMessage role={item.role} content={item.content} />}
        className="flex-1 px-4 pt-4"
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
      />
      {loading && <ActivityIndicator className="py-2" color="#16a34a" />}
      {error && <Text className="text-red-500 text-xs px-4 pb-1">{error}</Text>}
      <ChatInput value={input} onChangeText={setInput} onSend={handleSend} disabled={loading} />
    </KeyboardAvoidingView>
  )
}
