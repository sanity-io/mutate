import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  dts: 'rolldown',
  extract: {
    rules: {
      'ae-missing-release-tag': 'off',
      // do not require internal members to be prefixed with `_`
      'ae-internal-missing-underscore': 'off',
    },
    // Resolve build issue downstream with `error TS2742: The inferred type of 'createDatasetMutator' cannot be named without a reference to '/node_modules/mendoza'. This is likely not portable. A type annotation is necessary.`
    bundledPackages: ['mendoza'],
  },
  // the path to the tsconfig file for distributed builds
  tsconfig: 'tsconfig.dist.json',
})
