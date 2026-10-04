import { useState } from 'react'
import { Image, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native'
import { useAuthStore } from '../../stores/authStore'
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton'
import { Button, Input, Heading, Text } from '../../components/ui'

export default function RegisterScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const { signUp, loading, error } = useAuthStore()
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-background">
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View
        className="flex-1 justify-center px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="items-center mb-10">
          <Image
            source={require('../../assets/brand-mark.png')}
            className="h-20 w-20 rounded-3xl mb-4"
            accessibilityLabel="Poshan AI logo"
          />
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

        <GoogleSignInButton />

        <View className="flex-row justify-center mt-6">
          <Text variant="bodySm" muted>Already have an account? </Text>
          <Link href="/(auth)/login">
            <Text variant="bodySm" className="text-primary font-semibold">Sign in</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
    </View>
  )
}
