import { View } from 'react-native'
import { Text } from '../ui'
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
          isUser ? 'bg-primary rounded-br-sm' : 'bg-surface border border-border rounded-bl-sm'
        }`}
      >
        <Text variant="body" className={isUser ? 'text-on-primary' : 'text-foreground'}>
          {content}
        </Text>
      </View>
    </View>
  )
}
