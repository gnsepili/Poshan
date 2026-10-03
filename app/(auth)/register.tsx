import { useState } from 'react'
import { View, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { Mail, Lock, Eye, EyeOff, Leaf } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { Button, Input, Heading, Text } from '../../components/ui'
import { useThemeColors } from '../../lib/theme'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const { signUp, loading, error } = useAuthStore()
  const insets = useSafeAreaInsets()
  const colors = useThemeColors()

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View
        className="flex-1 justify-center px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="items-center mb-10">
          <View className="h-16 w-16 rounded-3xl bg-primary items-center justify-center mb-4">
            <Leaf size={30} color={colors.onPrimary} />
          </View>
          <Heading level={1} uppercase>Get started</Heading>
          <Text variant="body" muted>Create your Poshan AI account</Text>
        </View>

        {error ? (
          <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
            <Text variant="bodySm" className="text-danger">{error}</Text>
          </View>
        ) : null}

        <View className="gap-4">
          <Input
            label="Email"
            icon={Mail}
            placeholder="you@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Input
            label="Password"
            icon={Lock}
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoComplete="password-new"
            textContentType="newPassword"
            rightIcon={show ? EyeOff : Eye}
            onRightIconPress={() => setShow((s) => !s)}
            rightIconLabel={show ? 'Hide password' : 'Show password'}
            helper="Use 6 or more characters."
          />
        </View>

        <View className="mt-6">
          <Button label="Create account" loading={loading} onPress={() => signUp(email, password)} />
        </View>

        <View className="flex-row justify-center mt-6">
          <Text variant="bodySm" muted>Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text variant="bodySm" className="text-primary font-semibold">Sign in</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
