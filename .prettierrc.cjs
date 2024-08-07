const preset = require('@sanity/prettier-config')

module.exports = {
  ...preset,
  printWidth: 80,
  arrowParens: 'avoid',
}
