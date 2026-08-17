import {defineRouting} from 'next-intl/routing';
 
export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'ru'],
 
  // Used when no locale matches
  defaultLocale: 'ru',

  // Explicit prefixes avoid ambiguous URLs and keep locale switches predictable.
  localePrefix: 'always'
});
