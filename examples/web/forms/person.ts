import {defineForm} from '@sanity/sanitype'

import {address, person} from '../schema/person'

const addressForm = defineForm(address, {
  fields: {
    street: {
      form: {readonly: true},
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

/**
 * Define a form for the person type. TypeScript will yell at you if you don't declare a field for all properties defined
 * for the schema type
 */
export const personForm = defineForm(person, {
  fields: {
    name: {
      title: 'Name',
    },
    bio: {
      title: 'Content',
      form: {
        types: {
          code: {
            title: 'Code',
            form: {
              fields: {
                language: {
                  title: 'Language',
                  form: {
                    types: {
                      js: {title: 'JavaScript'},
                      ts: {title: 'TypeScript'},
                      py: {title: 'Python'},
                    },
                  },
                },
                text: {title: 'Text', form: {multiline: true}},
                author: {title: 'Author'},
              },
            },
          },
          blockquote: {
            title: 'Block quote',
            form: {
              fields: {
                text: {title: 'Text', form: {multiline: true}},
                style: {
                  title: 'Style',
                  form: {
                    types: {
                      normal: {title: 'Normal'},
                      fancy: {title: 'Fancy'},
                    },
                  },
                },
                author: {title: 'Author'},
              },
            },
          },
          paragraph: {
            title: 'Paragraph',
            form: {
              fields: {
                text: {title: 'Text', form: {multiline: true}},
                author: {title: 'Author'},
              },
            },
          },
        },
      },
    },
    address: {
      title: 'Address',
      form: addressForm,
    },
    favoritePet: {
      title: 'Favorite pet',
      form: {
        types: {
          feline: {
            title: 'Feline',
            form: {
              fields: {
                name: {
                  title: 'Name',
                },
                meows: {
                  title: 'Meows',
                },
              },
            },
          },
          canine: {
            title: 'Canine',
            form: {
              fields: {
                name: {
                  title: 'Name',
                },
                barks: {
                  title: 'Barks',
                },
              },
            },
          },
          avine: {
            title: 'Avine',
            form: {
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
    },
  },
})
