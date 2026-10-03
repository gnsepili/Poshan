import { View, TextInput } from 'react-native'
import { ArrowUp } from 'lucide-react-native'
import { IconButton } from '../ui'
import { useThemeColors } from '../../lib/theme'

interface Props {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  disabled?: boolean
}

export function ChatInput({ value, onChangeText, onSend, disabled }: Props) {
  const colors = useThemeColors()
  const canSend = value.trim().length > 0 && !disabled

  return (
    <View className="flex-row items-end gap-2 px-4 py-3 bg-surface border-t border-border">
      <TextInput
        className="flex-1 font-sans text-base text-foreground border border-border-strong rounded-2xl px-4 py-3 max-h-28 bg-surface-muted"
        placeholder="Message your coach..."
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        multiline
        returnKeyType="send"
        onSubmitEditing={onSend}
      />
      <IconButton
        icon={ArrowUp}
        accessibilityLabel="Send message"
        variant="primary"
        onPress={onSend}
        disabled={!canSend}
      />
    </View>
  )
}
