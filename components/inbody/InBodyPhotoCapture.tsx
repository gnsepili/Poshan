import { useState } from 'react'
import { View, Pressable, Image, ActivityIndicator, Text } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'

interface Props {
  onUploaded: (path: string) => void
}

export function InBodyPhotoCapture({ onUploaded }: Props) {
  const { user } = useAuthStore()
  const [uri, setUri] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return
    setUri(asset.uri)
    setUploading(true)
    setUploadError(null)
    // Private bucket: store the PATH; the analysis fn and reads sign it server-side.
    const path = `${user.id}/${Date.now()}.jpg`
    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 })
    const arrayBuffer = decode(base64)
    const { error } = await supabase.storage
      .from('inbody-photos')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false })
    setUploading(false)
    if (error) { setUploadError(error.message); return }
    onUploaded(path)
  }

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (!result.canceled) await upload(result.assets[0])
  }
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (!result.canceled) await upload(result.assets[0])
  }

  if (uploading) return <ActivityIndicator className="my-4" />

  return (
    <View>
      <View className="border-2 border-dashed border-gray-300 rounded-xl h-40 items-center justify-center mb-3 overflow-hidden">
        {uri ? <Image source={{ uri }} className="w-full h-full" resizeMode="contain" /> : <Text className="text-gray-400">No scan selected</Text>}
      </View>
      <View className="flex-row gap-2 mb-2">
        <Pressable onPress={takePhoto} className="flex-1 bg-green-600 rounded-lg py-3 items-center"><Text className="text-white font-semibold">Take photo</Text></Pressable>
        <Pressable onPress={pickPhoto} className="flex-1 bg-white border border-gray-300 rounded-lg py-3 items-center"><Text className="text-gray-700 font-semibold">Choose from gallery</Text></Pressable>
      </View>
      {uploadError && <Text className="text-red-500 text-xs mb-2">{uploadError}</Text>}
    </View>
  )
}
