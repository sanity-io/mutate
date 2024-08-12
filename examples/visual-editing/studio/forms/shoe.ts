import {defineForm} from '@sanity/sanitype'

import {shoe} from '../schema/shoe'

export const shoeForm = defineForm(shoe, {
  fields: {
    name: {
      title: 'Name',
    },
    model: {
      title: 'Model',
      types: {
        airmax: {
          title: 'Air Max',
          fields: {
            color: {
              title: 'Color',
              // @ts-expect-error it's fine
              color: true,
            },
            gel: {
              title: 'Gel',
              // @ts-expect-error it's fine
              color: true,
            },
          },
        },
        dunklow: {
          title: 'Dunk Low',
          fields: {
            coatFront: {
              title: 'Coat Front',
              // @ts-expect-error it's fine
              color: true,
            },
            coatMiddle: {
              title: 'Coat Middle',
              // @ts-expect-error it's fine
              color: true,
            },
            coatBack: {
              title: 'Coat Back',
              // @ts-expect-error it's fine
              color: true,
            },
            inner: {
              title: 'Inner',
              // @ts-expect-error it's fine
              color: true,
            },
            laces: {
              title: 'Laces',
              // @ts-expect-error it's fine
              color: true,
            },
            neck: {
              title: 'Neck',
              // @ts-expect-error it's fine
              color: true,
            },
            nikeLogo: {
              title: 'Nike Logo',
              // @ts-expect-error it's fine
              color: true,
            },
            nikeText: {
              title: 'Nike Text',
              // @ts-expect-error it's fine
              color: true,
            },
            patch: {
              title: 'Patch',
              // @ts-expect-error it's fine
              color: true,
            },
            soleTop: {
              title: 'Sole Top',
              // @ts-expect-error it's fine
              color: true,
            },
            soleBottom: {
              title: 'Sole Bottom',
              // @ts-expect-error it's fine
              color: true,
            },
            towel: {
              title: 'Towel',
              // @ts-expect-error it's fine
              color: true,
            },
          },
        },
        ultraboost: {
          title: 'Ultraboost',
          fields: {
            band: {
              title: 'Band',
              // @ts-expect-error it's fine
              color: true,
              preset: 2,
            },
            caps: {
              title: 'Caps',
              // @ts-expect-error it's fine
              color: true,
              preset: 1,
            },
            inner: {
              title: 'Inner',
              // @ts-expect-error it's fine
              color: true,
              preset: 4,
            },
            laces: {
              title: 'Laces',
              // @ts-expect-error it's fine
              color: true,
              preset: 4,
            },
            mesh: {
              title: 'Mesh',
              // @ts-expect-error it's fine
              color: true,
              preset: 0,
            },
            patch: {
              title: 'Patch',
              // @ts-expect-error it's fine
              color: true,
              preset: 0,
            },
            sole: {
              title: 'Sole',
              // @ts-expect-error it's fine
              color: true,
              preset: 1,
            },
            stripes: {
              title: 'Stripes',
              // @ts-expect-error it's fine
              color: true,
              preset: 1,
            },
          },
        },
      },
    },
  },
})
