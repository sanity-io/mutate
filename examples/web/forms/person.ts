import {defineForm} from '@sanity/sanitype'

import {address, person} from '../schema/person'
import {textsDemo} from '../schema/textsDemo'

const addressForm = defineForm(address, {
  title: 'Address',
  fields: {
    street: {
      readonly: true,
      title: 'Street',
    },
    city: {
      title: 'City',
    },
    country: {
      title: 'Country',
    },
  },
})

export const textsDemoForm = defineForm(textsDemo, {
  fields: {
    title: {title: 'Title'},
    textOne: {title: 'Text 1', multiline: true},
    textTwo: {title: 'Text 2', multiline: true},
    textThree: {title: 'Text 3', multiline: true},
  },
})
/**
 * Define a form for the person type. TypeScript will yell at you if you don't declare a field for all properties defined
 * for the schema type
 */
export const personForm = defineForm(person, {
  fields: {
    name: {
      title: 'Name',
    },
    foo: {
      title: 'Optional',
    },
    bio: {
      title: 'Bio',
      types: {
        code: {
          title: 'Code',
          fields: {
            language: {
              title: 'Language',
              types: {
                js: {title: 'JavaScript'},
                ts: {title: 'TypeScript'},
                py: {title: 'Python'},
              },
            },
            text: {title: 'Text', multiline: true},
            author: {title: 'Author'},
          },
        },
        blockquote: {
          title: 'Block quote',
          fields: {
            text: {title: 'Text', multiline: true},
            style: {
              title: 'Style',
              types: {
                normal: {title: 'Normal'},
                fancy: {title: 'Fancy'},
              },
            },
            author: {title: 'Author'},
          },
        },
        paragraph: {
          title: 'Paragraph',
          fields: {
            text: {title: 'Text', multiline: true},
            author: {title: 'Author'},
          },
        },
      },
    },
    address: addressForm,
    favoritePet: {
      title: 'Favorite pet',
      types: {
        feline: {
          title: 'Feline',
          fields: {
            name: {
              title: 'Name',
            },
            meows: {
              title: 'Meows',
            },
          },
        },
        canine: {
          title: 'Canine',
          fields: {
            name: {
              title: 'Name',
            },
            barks: {
              title: 'Barks',
            },
          },
        },
        avine: {
          title: 'Avine',
          fields: {
            name: {
              title: 'Name',
            },
            squawks: {
              title: 'Squawks',
            },
          },
        },
      },
    },
  },
})
