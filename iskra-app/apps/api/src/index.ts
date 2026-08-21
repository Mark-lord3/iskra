import http from "node:http";
import net from "node:net";
import { Server } from "socket.io";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./db";
import { startCleanupJob } from "./jobs/event-cleanup";
import { registerSocketHandlers } from "./socket/register-socket";

async function findAvailablePort(startPort: number, attempts = 10) {
  for (let offset = 0; offset < attempts; offset += 1) {
    const port = startPort + offset;
    const available = await new Promise<boolean>((resolve) => {
      const tester = net.createServer();

      tester.once("error", () => resolve(false));
      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port);
    });

    if (available) {
      return port;
    }
  }

  throw new Error(`No open port found between ${startPort} and ${startPort + attempts - 1}.`);
}

async function start() {
  await connectDatabase();

  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      credentials: true
    }
  });

  registerSocketHandlers(io);
  startCleanupJob();

  const port = await findAvailablePort(env.PORT);
  if (port !== env.PORT) {
    console.warn(`Port ${env.PORT} is in use, switched Iskra API to ${port}.`);
  }

  server.listen(port, () => {
    console.log(`Iskra API listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start Iskra API", error);
  process.exit(1);
});
