import "./env.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createStore } from "./db/provider.js";

const port = Number(process.env["PORT"] ?? 3000);
const app = createApp(createStore());

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API escuchando en puerto ${info.port}`);
});

export default app;
