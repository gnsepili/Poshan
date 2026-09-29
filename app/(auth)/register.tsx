import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { Link } from 'expo-router'
import { useAuthStore } from '../../stores/authStore'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp, loading, error } = useAuthStore()

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold mb-8 text-gray-900">Create account</Text>
      {error && <Text className="text-red-500 mb-4">{error}</Text>}
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        className="bg-green-600 rounded-lg py-4 items-center"
        onPress={() => signUp(email, password)}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Create account</Text>}
      </Pressable>
      <Link href="/(auth)/login" className="text-center mt-4 text-green-600">
        Already have an account? Sign in
      </Link>
    </View>
  )
}
