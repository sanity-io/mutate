import '@shikijs/vitepress-twoslash/style.css'
import './style.css'

import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import {h} from 'vue'
import type {Theme} from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import MutateMark from './MutateMark.vue'

export default {
  extends: DefaultTheme,
  // Override the home-hero-image slot with the animated, inlined SVG mark.
  // Inlining gives us CSS access to individual <g> groups for the
  // build-on-load + hover transitions in MutateMark.vue.
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(MutateMark),
    }),
  enhanceApp({app}) {
    app.use(TwoslashFloatingVue)
  },
} satisfies Theme
