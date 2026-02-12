import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const adminEmails = (process.env.PLAYMASTERS_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const allowAllWhenUnset = adminEmails.length === 0;

const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? 'placeholder-google-client-id';
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? 'placeholder-google-client-secret';

const authSecret =
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === 'development' ? 'dev-nextauth-secret' : undefined);

const nextAuth = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  ],
  secret: authSecret,
  session: { strategy: 'jwt' },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.email ?? '';
        const email = session.user.email?.toLowerCase() ?? '';
        session.user.isAdmin = allowAllWhenUnset
          ? Boolean(session.user.id)
          : email
            ? adminEmails.includes(email)
            : false;
      }
      return session;
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;

export const authConfig = {
  callbacks: {
    authorized({ auth }: { auth?: { user?: { isAdmin?: boolean } } }) {
      // In development allow if session exists; otherwise enforce admin flag.
      if (process.env.NODE_ENV === 'development') return Boolean(auth?.user);
      return !!auth?.user && auth.user.isAdmin === true;
    },
  },
};
