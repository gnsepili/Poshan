module.exports = function (api) {
  const isTest = api.env('test')
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      'react-native-worklets/plugin',
      // Jest's CommonJS transform can't execute a real dynamic import() at runtime
      // (throws "invoked without --experimental-vm-modules"); this rewrites it to a
      // Promise-wrapped require() under test only. Metro/production bundling is
      // unaffected. Needed for authStore's dynamic `import('../lib/storeReset')`.
      ...(isTest ? ['babel-plugin-dynamic-import-node'] : []),
    ],
  }
}
