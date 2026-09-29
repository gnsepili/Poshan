import { useState } from 'react'
import { View, Pressable, Image, ActivityIndicator, Text } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  onUploaded: (url: string) => void
}

export function MealPhotoCapture({ onUploaded }: Props) {
  const { user } = useAuthStore()
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
    const response = await fetch(asset.uri)
    const blob = await response.blob()
    const { error } = await supabase.storage.from('meal-photos').upload(fileName, blob, { contentType: 'image/jpeg' })
    setUploading(false)
    if (error) {
      setUploadError(error.message)
      return
    }
    const { data } = supabase.storage.from('meal-photos').getPublicUrl(fileName)
    onUploaded(data.publicUrl)
  }

  if (uploading) return <ActivityIndicator className="my-4" />

  return (
    <View>
      <Pressable onPress={pick} className="border-2 border-dashed border-gray-300 rounded-xl h-40 items-center justify-center mb-4">
        {uri ? <Image source={{ uri }} className="w-full h-full rounded-xl" /> : <Text className="text-gray-400">Tap to capture meal photo</Text>}
      </Pressable>
      {uploadError && <Text className="text-red-500 text-xs mb-4">{uploadError}</Text>}
    </View>
  )
}
