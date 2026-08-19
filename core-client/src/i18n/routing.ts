import {defineRouting} from 'next-intl/routing';
import {locales} from './locales';
 
export const routing = defineRouting({
  // A list of all locales that are supported
  locales,
 
  // Used when no locale matches
  defaultLocale: 'ru',

  // Explicit prefixes avoid ambiguous URLs and keep locale switches predictable.
  localePrefix: 'always'
});
