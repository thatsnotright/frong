import { serve } from "bun";
import index from "./index.html";

const server = serve({
  routes: {
    // The whole game is a single page.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🐸 Frong running at ${server.url}`);
