import createMiddleware from 'next-intl/middleware';
import {routing} from '@/i18n/routing';

export default createMiddleware(routing);

// Next.js must be able to statically read this value from the root proxy file.
export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
