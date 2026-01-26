import { NextResponse } from 'next/server';
import { auth } from './src/auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isAdminRoute = nextUrl.pathname.startsWith('/admin');

  if (isAdminRoute) {
    if (!req.auth) {
      const signInUrl = new URL('/api/auth/signin', nextUrl.origin);
      signInUrl.searchParams.set('callbackUrl', nextUrl.href);
      return NextResponse.redirect(signInUrl);
    }

    if (!req.auth.user?.isAdmin) {
      return NextResponse.redirect(new URL('/', nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*'],
};
