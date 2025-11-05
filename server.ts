import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import messageRoutes from "./routes/messages.js"
import { initSocket } from "./socket/index.js"

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL } })

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())

app.use("/auth", authRoutes)
app.use("/users", userRoutes)
app.use("/messages", messageRoutes)


initSocket(io)

server.listen(process.env.PORT || 4000, () => console.log("Server running"))
