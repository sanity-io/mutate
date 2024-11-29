module.exports = {
  extends: '../../.eslintrc.cjs',
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: true,
        tsconfigRootDir: `${__dirname}`,
      },
      extends: [
        'eslint:recommended',
        'plugin:prettier/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended',
        'plugin:react/jsx-runtime',
      ],
      plugins: ['import', '@typescript-eslint', 'prettier', 'react-compiler'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/member-delimiter-style': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {prefer: 'type-imports'},
        ],
        '@typescript-eslint/no-dupe-class-members': ['error'],
        '@typescript-eslint/no-shadow': ['error'],
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': ['warn'],
        'import/no-duplicates': ['error', {'prefer-inline': true}],
        'import/first': 'error',
        'import/newline-after-import': 'error',
        'import/consistent-type-specifier-style': ['error', 'prefer-inline'],
        'import/order': 'off', // handled by simple-import-sort
        'sort-imports': 'off', // handled by simple-import-sort
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
        'react-compiler/react-compiler': 'error',
      },
    },
  ],
}
