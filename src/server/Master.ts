import cluster from "cluster";
import express from "express";
import rateLimit from "express-rate-limit";
import http from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { getServerConfigFromServer } from "../core/configuration/ConfigLoader";
import { ID } from "../core/Schemas";
import { logger } from "./Logger";

const config = getServerConfigFromServer();
const readyWorkers = new Set();

const app = express();
const server = http.createServer(app);

const log = logger.child({ comp: "m" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.json());
app.use(
  express.static(path.join(process.cwd(), "static"), {
    maxAge: "1y", // Set max-age to 1 year for all static assets
    setHeaders: (res, path) => {
      // You can conditionally set different cache times based on file types
      if (path.endsWith(".html")) {
        // Set HTML files to no-cache to ensure Express doesn't send 304s
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        // Prevent conditional requests
        res.setHeader("ETag", "");
      } else if (path.match(/\.(js|css|svg)$/)) {
        // JS, CSS, SVG get long cache with immutable
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (path.match(/\.(bin|dat|exe|dll|so|dylib)$/)) {
        // Binary files also get long cache with immutable
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      // Other file types use the default maxAge setting
    },
  }),
);
app.use(express.json());

app.set("trust proxy", 3);
app.use(
  rateLimit({
    windowMs: 1000, // 1 second
    max: 20, // 20 requests per IP per second
  }),
);

// Start the master process
export async function startMaster() {
  if (!cluster.isPrimary) {
    throw new Error(
      "startMaster() should only be called in the primary process",
    );
  }

  log.info(`Primary ${process.pid} is running`);
  log.info(`Setting up ${config.numWorkers()} workers...`);

  // Fork workers
  for (let i = 0; i < config.numWorkers(); i++) {
    const worker = cluster.fork({
      WORKER_ID: i,
    });

    log.info(`Started worker ${i} (PID: ${worker.process.pid})`);
  }

  cluster.on("message", (worker, message) => {
    if (message.type === "WORKER_READY") {
      const workerId = message.workerId;
      readyWorkers.add(workerId);
      log.info(
        `Worker ${workerId} is ready. (${readyWorkers.size}/${config.numWorkers()} ready)`,
      );
      if (readyWorkers.size === config.numWorkers()) {
        log.info("All workers ready");
      }
    }
  });

  // Handle worker crashes
  cluster.on("exit", (worker, code, signal) => {
    const workerId = (worker as any).process?.env?.WORKER_ID;
    if (!workerId) {
      log.error(`worker crashed could not find id`);
      return;
    }

    log.warn(
      `Worker ${workerId} (PID: ${worker.process.pid}) died with code: ${code} and signal: ${signal}`,
    );
    log.info(`Restarting worker ${workerId}...`);

    // Restart the worker with the same ID
    const newWorker = cluster.fork({
      WORKER_ID: workerId,
    });

    log.info(
      `Restarted worker ${workerId} (New PID: ${newWorker.process.pid})`,
    );
  });

  const PORT = parseInt(process.env.PORT ?? "3000");
  server.listen(PORT, () => {
    log.info(`Master HTTP server listening on port ${PORT}`);
  });

  // Handle WebSocket upgrade requests and proxy to the correct worker
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    const match = url.match(/^\/w(\d+)/);
    
    if (match) {
      const workerIndex = parseInt(match[1]);
      const workerPort = config.workerPortByIndex(workerIndex);
      
      log.info(`Proxying WebSocket upgrade to worker ${workerIndex} on port ${workerPort}`);
      
      // Create a TCP connection to the worker
      const workerSocket = net.connect(workerPort, "localhost", () => {
        // Forward the original HTTP upgrade request to the worker
        const requestLine = `${req.method} ${url} HTTP/${req.httpVersion}\r\n`;
        const headers = Object.entries(req.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n");
        
        workerSocket.write(requestLine + headers + "\r\n\r\n");
        
        // Send any buffered data (the head)
        if (head.length > 0) {
          workerSocket.write(head);
        }
        
        // Pipe data between client and worker
        socket.pipe(workerSocket);
        workerSocket.pipe(socket);
      });
      
      workerSocket.on("error", (err) => {
        log.error(`Failed to connect to worker ${workerIndex}:`, err);
        socket.destroy();
      });
      
      socket.on("error", (err) => {
        log.error("Client socket error:", err);
        workerSocket.destroy();
      });
      
      socket.on("close", () => {
        workerSocket.destroy();
      });
      
      workerSocket.on("close", () => {
        socket.destroy();
      });
    } else {
      // No worker path, destroy the connection
      socket.destroy();
    }
  });
}

app.get("/api/env", async (req, res) => {
  const envConfig = {
    game_env: process.env.GAME_ENV,
  };
  if (!envConfig.game_env) return res.sendStatus(500);
  res.json(envConfig);
});

// Public lobbies endpoint - returns empty since we don't have public games
app.get("/api/public_lobbies", async (req, res) => {
  res.json({ lobbies: [] });
});

// Proxy /wX/... requests to the appropriate worker
// This is needed for Render deployment where nginx is not available
app.all(/^\/w(\d+)(\/.*)$/, async (req, res) => {
  const match = req.path.match(/^\/w(\d+)(\/.*)$/);
  if (!match) {
    res.status(400).json({ error: "Invalid worker path" });
    return;
  }

  const workerIndex = parseInt(match[1]);
  const pathWithoutPrefix = match[2];
  const workerPort = config.workerPortByIndex(workerIndex);

  // Build the target URL
  const queryString = Object.keys(req.query).length > 0 
    ? `?${new URLSearchParams(req.query as Record<string, string>).toString()}`
    : "";
  const targetUrl = `http://localhost:${workerPort}${pathWithoutPrefix}${queryString}`;

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        ...(req.headers[config.adminHeader()] 
          ? { [config.adminHeader()]: req.headers[config.adminHeader()] as string } 
          : {}),
      },
    };

    // Add body for non-GET requests
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    // Forward response status and headers
    res.status(response.status);
    
    // Handle JSON responses
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    log.error(`Error proxying to worker ${workerIndex}:`, error);
    res.status(502).json({ error: "Failed to proxy request to worker" });
  }
});

app.post("/api/kick_player/:gameID/:clientID", async (req, res) => {
  if (req.headers[config.adminHeader()] !== config.adminToken()) {
    res.status(401).send("Unauthorized");
    return;
  }

  const { gameID, clientID } = req.params;

  if (!ID.safeParse(gameID).success || !ID.safeParse(clientID).success) {
    res.sendStatus(400);
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:${config.workerPort(gameID)}/api/kick_player/${gameID}/${clientID}`,
      {
        method: "POST",
        headers: {
          [config.adminHeader()]: config.adminToken(),
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to kick player: ${response.statusText}`);
    }

    res.status(200).send("Player kicked successfully");
  } catch (error) {
    log.error(`Error kicking player from game ${gameID}:`, error);
    res.status(500).send("Failed to kick player");
  }
});

// SPA fallback route
app.get("*", function (req, res) {
  res.sendFile(path.join(process.cwd(), "static/index.html"));
});
