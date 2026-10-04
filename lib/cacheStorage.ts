import AsyncStorage from '@react-native-async-storage/async-storage'
import { createJSONStorage } from 'zustand/middleware'

// Device storage for the persisted (cached) stores. Its own module so tests can swap in
// an in-memory version without touching AsyncStorage (used directly by the meal queue).
export const cacheStorage = createJSONStorage(() => AsyncStorage)
