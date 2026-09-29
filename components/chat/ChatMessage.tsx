import { View, Text } from 'react-native'
import { ChatRole } from '../../types'

interface Props {
  role: ChatRole
  content: string
}

export function ChatMessage({ role, content }: Props) {
  const isUser = role === 'user'
  return (
    <View className={`mb-3 max-w-[80%] ${isUser ? 'self-end' : 'self-start'}`}>
      <View
        className={`px-4 py-3 rounded-2xl ${
          isUser ? 'bg-green-600 rounded-br-sm' : 'bg-white rounded-bl-sm shadow-sm border border-gray-100'
        }`}
      >
        <Text className={isUser ? 'text-white' : 'text-gray-900'}>{content}</Text>
      </View>
    </View>
  )
}
