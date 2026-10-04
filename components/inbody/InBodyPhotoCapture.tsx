import { useState } from 'react'
import { View, Image, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { Camera, Images } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/telemetry'
import { useAuthStore } from '../../stores/authStore'
import { PressableCard, Button, Text } from '../ui'
import { useThemeColors } from '../../lib/theme'

interface Props {
  onUploaded: (path: string) => void
}

export function InBodyPhotoCapture({ onUploaded }: Props) {
  const { user } = useAuthStore()
  const colors = useThemeColors()
  const [uri, setUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return
    setUri(asset.uri)
    setUploading(true)
    // Private bucket: store the PATH; the analysis fn and reads sign it server-side.
    const path = `${user.id}/${Date.now()}.jpg`
    try {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
      const { error } = await supabase.storage
        .from('inbody-photos')
        .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false })
      if (error) {
        setUploadError(`Couldn't upload the photo: ${error.message}`)
        return
      }
      onUploaded(path)
    } finally {
      setUploading(false)
    }
  }

  // Camera/library/file errors must never leave the spinner running.
  const capture = async (launch: () => Promise<ImagePicker.ImagePickerResult>) => {
    setUploadError(null)
    try {
      const result = await launch()
      if (!result.canceled) await upload(result.assets[0])
    } catch (e) {
      logError('inbody-photo-capture', e)
      setUploadError("Couldn't take or read the photo. Check permissions and try again.")
    }
  }
  const takePhoto = () => capture(() => ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] }))
  const pickPhoto = () => capture(() => ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] }))

  return (
    <View className="mb-4">
      <PressableCard
        onPress={takePhoto}
        disabled={uploading}
        padded={false}
        className="h-44 items-center justify-center overflow-hidden mb-3"
        accessibilityLabel={uri ? 'Retake InBody photo' : 'Take InBody photo'}
      >
        {uploading ? (
          <ActivityIndicator color={colors.primary} />
        ) : uri ? (
          <Image source={{ uri }} className="w-full h-full" resizeMode="contain" />
        ) : (
          <View className="items-center px-6">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft mb-3">
              <Camera size={22} color={colors.primary} />
            </View>
            <Text variant="bodySm" muted className="text-center">
              Tap to snap a photo of your InBody printout
            </Text>
          </View>
        )}
      </PressableCard>

      <View className="flex-row gap-3">
        <Button
          label="Take photo"
          icon={Camera}
          onPress={takePhoto}
          disabled={uploading}
          className="flex-1"
        />
        <Button
          label="Choose from gallery"
          icon={Images}
          variant="secondary"
          onPress={pickPhoto}
          disabled={uploading}
          className="flex-1"
        />
      </View>
      {uploadError ? (
        <Text variant="caption" className="text-danger mt-2">{uploadError}</Text>
      ) : null}
    </View>
  )
}
