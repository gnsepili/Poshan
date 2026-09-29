import { View, TextInput, Pressable, Text } from 'react-native'

interface Props {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  disabled?: boolean
}

export function ChatInput({ value, onChangeText, onSend, disabled }: Props) {
  const canSend = value.trim().length > 0 && !disabled

  return (
    <View className="flex-row items-end px-4 py-3 bg-white border-t border-gray-100">
      <TextInput
        className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 mr-2 max-h-28 bg-gray-50"
        placeholder="Message your coach..."
        value={value}
        onChangeText={onChangeText}
        multiline
        returnKeyType="send"
        onSubmitEditing={onSend}
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        className={`w-10 h-10 rounded-full items-center justify-center ${canSend ? 'bg-green-600' : 'bg-gray-200'}`}
      >
        <Text className="text-white font-bold">↑</Text>
      </Pressable>
    </View>
  )
}
