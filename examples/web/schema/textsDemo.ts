import {document, literal, string} from '@sanity/sanitype'

export const textsDemo = document({
  _type: literal('textsDemo'),
  title: string(),
  textOne: string(),
  textTwo: string(),
  textThree: string(),
})
