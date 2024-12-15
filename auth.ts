import Google from "next-auth/providers/google";
import NextAuth from "next-auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                url: "https://accounts.google.com/o/oauth2/v2/auth",
                params: {
                    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
                    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token;
            }

            return token;
        },
        async session({ session, token }) {
            if (token.accessToken) {
                session.accessToken = token.accessToken as string;
            } else {
                console.warn("No access token available in session callback");
            }

            return session;
        },
    },
    debug: true,
});

export { handlers as GET, handlers as POST };
