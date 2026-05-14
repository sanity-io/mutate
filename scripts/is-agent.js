#!/usr/bin/env node
import {isAgent} from 'std-env'

// eslint-disable-next-line no-undef
process.exit(isAgent ? 0 : 1)
