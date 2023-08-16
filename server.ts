import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

server.listen(process.env.PORT || 3000, () =>
  console.log(`Server up and listening on port ${process.env.PORT}`)
);
