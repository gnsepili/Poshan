import { Component, ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import { logError } from '../lib/telemetry'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

// Top-level render-crash safety net: catches errors thrown during rendering
// anywhere below it, logs them (best-effort, never throws), and shows a
// fallback UI instead of a white screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    logError('react-error-boundary', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 items-center justify-center bg-gray-50 px-8">
          <Text className="text-lg font-bold text-gray-900 mb-2">Something went wrong</Text>
          <Text className="text-gray-500 text-center mb-6">The app hit an unexpected error. It has been logged.</Text>
          <Pressable className="bg-green-600 rounded-lg px-6 py-3" onPress={() => this.setState({ hasError: false })}>
            <Text className="text-white font-semibold">Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
