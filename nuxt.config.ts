// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },

  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxt/eslint",
    "@nuxt/icon",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "@nuxtjs/supabase",
  ],

  app: {
    head: {
      title: "Junglefy - Plants & Flowers E-Commerce",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "API-first headless e-commerce for plants and flowers",
        },
      ],
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },

  runtimeConfig: {
    apiSecret: "",
    public: {
      apiBase: "/api",
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  nitro: {
    experimental: {
      openAPI: true,
    },
    routeRules: {
      "/api/**": {
        cors: true,
        headers: {
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      },
    },
  },

  supabase: {
    redirect: false,
  },
});
