import NextAuth from "next-auth";

declare module "next-auth" {
    interface Session {
        accessToken?: string; // Добавляем кастомное поле accessToken
    }

    interface JWT {
        accessToken?: string; // Добавляем accessToken в токен
    }
}
