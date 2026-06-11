import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  // Note: with `dts: 'rolldown'`, internal code must not import the encoder
  // barrel files (e.g. `src/encoders/sanity/index.ts`) — only `src/index.ts`
  // may. If a barrel that is namespace-exported from the root entry becomes
  // shared with another entry's chunk, rolldown's `__exportAll` runtime helper
  // leaks into the emitted dts as an undeclared name (TS2304 for consumers
  // typechecking with `skipLibCheck: false`). Import leaf modules instead.
  dts: 'rolldown',
  extract: {
    rules: {
      'ae-missing-release-tag': 'off',
      // do not require internal members to be prefixed with `_`
      'ae-internal-missing-underscore': 'off',
    },
  },
  // the path to the tsconfig file for distributed builds
  tsconfig: 'tsconfig.dist.json',
})
