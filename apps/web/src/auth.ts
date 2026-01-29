import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const adminEmails = (process.env.PLAYMASTERS_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.email ?? '';
        const email = session.user.email?.toLowerCase() ?? '';
        session.user.isAdmin = email ? adminEmails.includes(email) : false;
      }
      return session;
    },
  },
});

export const authConfig = {
  callbacks: {
    authorized({ auth }: { auth: any }) {
      return !!auth?.user;
    },
  },
};
