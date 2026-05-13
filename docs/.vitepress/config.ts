import {transformerTwoslash} from '@shikijs/vitepress-twoslash'
import ts from 'typescript'
import {defineConfig} from 'vitepress'

// Repo-scoped GitHub Pages site lives at sanity-io.github.io/mutate/.
// Override with DOCS_BASE=/ for a root-served preview if needed.
const base = process.env.DOCS_BASE ?? '/mutate/'

export default defineConfig({
  title: '@sanity/mutate',
  description:
    'Experimental toolkit for working with Sanity mutations in JavaScript & TypeScript',
  appearance: 'dark',

  base,

  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `${base}mutate-logo-light.svg`,
        media: '(prefers-color-scheme: light)',
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `${base}mutate-logo-dark.svg`,
        media: '(prefers-color-scheme: dark)',
      },
    ],
  ],

  markdown: {
    theme: {
      light: 'catppuccin-latte',
      dark: 'tokyo-night',
    },
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            strict: true,
            // Resolve @sanity/mutate package exports via the "source"
            // condition so Twoslash reads the TypeScript source files
            // instead of the built .js files in dist/.
            customConditions: ['source'],
          },
        },
      }),
    ],
  },

  themeConfig: {
    logo: {
      light: '/mutate-logo-light.svg',
      dark: '/mutate-logo-dark.svg',
      alt: '@sanity/mutate',
    },

    nav: [
      {text: 'Guide', link: '/guide/getting-started'},
      {text: 'API', link: '/api/mutations'},
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          {text: 'Getting Started', link: '/guide/getting-started'},
          {text: 'Applying Mutations', link: '/guide/applying-mutations'},
          {text: 'Optimistic Store', link: '/guide/optimistic-store'},
          {text: 'Recipes', link: '/guide/recipes'},
          {
            text: 'Differences from the Sanity API',
            link: '/guide/differences-from-sanity-api',
          },
        ],
      },
      {
        text: 'API',
        items: [
          {text: 'Mutations', link: '/api/mutations'},
          {text: 'Patches', link: '/api/patches'},
          {text: 'Operations', link: '/api/operations'},
          {text: 'Encoders', link: '/api/encoders'},
        ],
      },
    ],

    socialLinks: [
      {icon: 'github', link: 'https://github.com/sanity-io/mutate'},
    ],

    editLink: {
      pattern: 'https://github.com/sanity-io/mutate/edit/main/docs/:path',
    },

    search: {provider: 'local'},
  },
})
