import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  // TODO: switch back to `dts: 'rolldown'` once rolldown-plugin-dts no longer emits
  // a phantom `__exportAll` (TS2304) for consumers typechecking with `skipLibCheck: false`
  dts: 'api-extractor',
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
