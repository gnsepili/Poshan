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
        <View className="flex-1 items-center justify-center bg-background px-8">
          <Text className="font-display text-2xl uppercase tracking-wide text-foreground mb-2">
            Something went wrong
          </Text>
          <Text className="font-sans text-base text-muted-foreground text-center mb-6">
            The app hit an unexpected error. It has been logged.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="bg-primary rounded-2xl px-6 h-12 justify-center active:bg-primary-pressed"
            onPress={() => this.setState({ hasError: false })}
          >
            <Text className="font-bold text-base text-on-primary">Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
