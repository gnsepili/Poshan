// Persisted stores cache through lib/cacheStorage; in tests use a synchronous in-memory
// store so store tests stay isolated from the AsyncStorage mocks they assert on.
jest.mock('./lib/cacheStorage', () => {
  const memory = new Map()
  return {
    cacheStorage: {
      getItem: (name) => memory.get(name) ?? null,
      setItem: (name, value) => {
        memory.set(name, value)
      },
      removeItem: (name) => {
        memory.delete(name)
      },
    },
  }
})

jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'))
