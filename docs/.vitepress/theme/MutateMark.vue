<script setup lang="ts">
import {useData} from 'vitepress'

const {isDark} = useData()
</script>

<template>
  <svg
    class="image-src mutate-mark"
    :class="{'mutate-mark--dark': isDark}"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 224 224"
    role="img"
    aria-label="@sanity/mutate"
  >
    <title>@sanity/mutate</title>
    <g transform="translate(147 142)">
      <g transform="skewY(-16)">
        <g class="mutate-mark__grid" transform="translate(56 -56)">
          <rect x="-120" y="-69" width="32" height="32" />
          <rect x="-79" y="-69" width="32" height="32" />
          <rect x="-38" y="-69" width="32" height="32" />
          <rect x="-120" y="-28" width="32" height="32" />
          <rect x="-79" y="-28" width="32" height="32" />
          <rect x="-38" y="-28" width="32" height="32" />
          <rect x="-120" y="13" width="32" height="32" />
          <rect x="-79" y="13" width="32" height="32" />
          <rect x="-38" y="13" width="32" height="32" />
        </g>
        <g class="mutate-mark__stack mutate-mark__stack--back" transform="translate(24 -24)">
          <rect x="-120" y="-69" width="32" height="32" />
          <rect x="-120" y="13" width="32" height="32" />
          <rect x="-38" y="13" width="32" height="32" />
        </g>
        <g class="mutate-mark__stack mutate-mark__stack--mid" transform="translate(12 -12)">
          <rect x="-120" y="-69" width="32" height="32" />
          <rect x="-120" y="13" width="32" height="32" />
          <rect x="-38" y="13" width="32" height="32" />
        </g>
        <g class="mutate-mark__stack mutate-mark__stack--front">
          <rect x="-120" y="-69" width="32" height="32" />
          <rect x="-120" y="13" width="32" height="32" />
          <rect x="-38" y="13" width="32" height="32" />
        </g>
        <g class="mutate-mark__pending">
          <rect x="-79" y="-69" width="32" height="32" stroke-dasharray="5.5 4.5" />
          <rect x="-38" y="-69" width="32" height="32" stroke-dasharray="5.5 4.5" />
          <rect x="-120" y="-28" width="32" height="32" stroke-dasharray="5.5 4.5" />
          <rect x="-79" y="-28" width="32" height="32" stroke-dasharray="5.5 4.5" />
          <rect x="-38" y="-28" width="32" height="32" stroke-dasharray="5.5 4.5" />
          <rect x="-79" y="13" width="32" height="32" stroke-dasharray="5.5 4.5" />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.mutate-mark {
  --grid: #5e5e5e;
  --orange: #ff5500;
  /* Positioning + sizing come from VitePress's .image-src class. */
}

.mutate-mark--dark {
  --grid: #cecece;
  --orange: #ff7733;
}

.mutate-mark__grid rect {
  fill: var(--grid);
}

.mutate-mark__stack rect {
  fill: var(--orange);
}

.mutate-mark__stack--back {
  opacity: 0.4;
}

.mutate-mark__stack--mid {
  opacity: 0.7;
}

.mutate-mark__pending rect {
  fill: none;
  stroke: var(--orange);
  stroke-width: 2.5;
  vector-effect: non-scaling-stroke;
}

/* Build-on-load: 1.2s sequence — fade groups in in order. Only `opacity`
 * is animated so the SVG `transform` attributes on each <g> stay
 * authoritative (CSS `transform` on SVG groups replaces the attribute,
 * which would unskew and break the isometric composition). */
.mutate-mark__grid,
.mutate-mark__pending,
.mutate-mark__stack {
  opacity: 0;
  animation: mark-fade-in 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

.mutate-mark__grid {
  animation-delay: 0s;
}

.mutate-mark__pending {
  animation-delay: 0.2s;
}

.mutate-mark__stack--back {
  animation-name: mark-fade-back;
  animation-delay: 0.4s;
}

.mutate-mark__stack--mid {
  animation-name: mark-fade-mid;
  animation-delay: 0.55s;
}

.mutate-mark__stack--front {
  animation-delay: 0.7s;
}

@keyframes mark-fade-in {
  to {
    opacity: 1;
  }
}

@keyframes mark-fade-back {
  to {
    opacity: 0.4;
  }
}

@keyframes mark-fade-mid {
  to {
    opacity: 0.7;
  }
}

/* Accessibility: prefers-reduced-motion zeroes the build-on-load
 * sequence to the static end state. */
@media (prefers-reduced-motion: reduce) {
  .mutate-mark__grid,
  .mutate-mark__pending,
  .mutate-mark__stack--front {
    opacity: 1;
    animation: none;
  }
  .mutate-mark__stack--back {
    opacity: 0.4;
    animation: none;
  }
  .mutate-mark__stack--mid {
    opacity: 0.7;
    animation: none;
  }
}
</style>
