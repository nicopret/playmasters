import { NextResponse } from 'next/server';
import { auth } from './src/auth';

export default auth((req) => {
  const { nextUrl } = req;

  // In development, allow access without redirect to simplify local testing.
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  if (!req.auth) {
    const signInUrl = new URL('/api/auth/signin', nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  if (!req.auth.user?.isAdmin) {
    return NextResponse.redirect(new URL('http://localhost:3000/', nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api/auth|_next|favicon\\.ico).*)'],
};
