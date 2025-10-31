import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import { prisma } from "./prisma/client.js"
import { Socket } from "dgram"

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL } })
const onlineUsers = new Map()

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET as string
if (!JWT_SECRET) throw new Error("tokenT is not defined")

io.on("connection", (socket) => {

    console.log("New client connected", socket.id)
    socket.on("signup", async (data, callback) => {
        try {
            const { username, password, confirmPassword } = data
            if (!username || !password || !confirmPassword)
                return callback({ error: "All fields required" })
            if (password !== confirmPassword)
                return callback({ error: "Passwords do not match" })

            const exists = await prisma.user.findUnique({ where: { username } })
            if (exists) return callback({ error: "Username already taken" })

            const user = await prisma.user.create({ data: { username, password } })
            callback({ success: true, user })
        } catch {
            callback({ error: "Signup failed" })
        }
    })

    socket.on("login", async (data, callback) => {
        try {
            const { username, password } = data
            const user = await prisma.user.findUnique({ where: { username } })
            if (!user || user.password !== password)
                return callback({ error: "Invalid credentials" })

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET)
            callback({ success: true, token, user })
        } catch {
            callback({ error: "Login failed" })
        }
    })

    socket.on("authenticate", async (data, callback) => {
        try {
            const decoded: any = jwt.verify(data.token, JWT_SECRET)
            const user = await prisma.user.findUnique({ where: { id: decoded.id } })
            if (!user) return callback({ error: "Invalid token" })
            socket.data.user = user
            onlineUsers.set(user.username, socket.id)
            callback({ success: true, user })
            io.emit("user_online", { id: user.id, username: user.username })
        } catch {
            callback({ error: "Auth failed" })
        }
    })

    socket.on("get_users", async (callback) => {
        try {
            const user = socket.data.user
            if (!user) return callback({ error: "Unauthorized" })

            const users = await prisma.user.findMany({
                where: { id: { not: user.id } },
                select: { id: true, username: true },
            })
            callback({ success: true, users })
        } catch {
            callback({ error: "Failed to fetch users" })
        }
    })

    socket.on("send_message", (data) => {
        const user = socket.data.user
        if (!user) return

        const messageData = {
            from: user.username,
            to: data.to,
            text: data.text,
        }

        const receiverSocket = onlineUsers.get(data.to)
        if (receiverSocket) {
            io.to(receiverSocket).emit("receive_message", messageData)
        }

        socket.emit("receive_message", messageData)
    })




    socket.on("disconnect", () => {
        console.log("User disconnected", socket.id)
        const user = socket.data.user
        if (user) {
            onlineUsers.delete(user.username)
            io.emit("user_offline", { id: user.id, username: user.username })
        }
    })
})

const PORT = Number(process.env.PORT) || 4000
server.listen(PORT, () => console.log(`server running`))
