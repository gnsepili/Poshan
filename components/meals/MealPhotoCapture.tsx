import { useState } from 'react'
import { View, Pressable, Image, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { Camera } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { Text } from '../ui'
import { useThemeColors } from '../../lib/theme'

interface Props {
  onUploaded: (url: string) => void
}

export function MealPhotoCapture({ onUploaded }: Props) {
  const { user } = useAuthStore()
  const colors = useThemeColors()
  const [uri, setUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const pick = async () => {
    if (!user) return
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (result.canceled) return
    const asset = result.assets[0]
    setUri(asset.uri)
    setUploading(true)
    setUploadError(null)

    const fileName = `${user.id}/${Date.now()}.jpg`
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = decode(base64)
    const { error } = await supabase.storage
      .from('meal-photos')
      .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: false })
    setUploading(false)
    if (error) {
      setUploadError(error.message)
      return
    }
    const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName)
    onUploaded(data.publicUrl)
  }

  if (uploading) {
    return (
      <View className="h-40 items-center justify-center rounded-2xl bg-surface-muted mb-1">
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  return (
    <View>
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Retake meal photo' : 'Capture meal photo'}
        className="h-40 items-center justify-center rounded-2xl bg-surface-muted border border-border overflow-hidden active:bg-surface"
      >
        {uri ? (
          <Image source={{ uri }} className="w-full h-full" />
        ) : (
          <View className="items-center gap-2">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
              <Camera size={22} color={colors.primary} />
            </View>
            <Text variant="bodySm" muted>
              Tap to capture meal photo
            </Text>
          </View>
        )}
      </Pressable>
      {uploadError ? (
        <Text variant="caption" className="text-danger mt-2">
          {uploadError}
        </Text>
      ) : null}
    </View>
  )
}
