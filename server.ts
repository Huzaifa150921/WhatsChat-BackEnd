import express from "express"
import http from "http"
import { Server } from "socket.io"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import { prisma } from "./prisma/client.js"

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL } })
const onlineUsers = new Map()

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in .env file")
}

io.on("connection", (socket) => {
    socket.on("signup", async (data, callback) => {
        try {
            const { displayName, username, password, confirmPassword } = data
            if (!displayName || !username || !password || !confirmPassword)
                return callback({ error: "All fields required" })
            if (password !== confirmPassword)
                return callback({ error: "Passwords do not match" })
            const exists = await prisma.user.findUnique({ where: { username } })
            if (exists) return callback({ error: "Username already taken" })
            const user = await prisma.user.create({ data: { displayName, username, password } })
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
            const decoded = jwt.verify(data.token, JWT_SECRET)
            if (typeof decoded !== "object" || !("id" in decoded)) {
                return callback({ error: "Invalid token payload" })
            }
            const user = await prisma.user.findUnique({ where: { id: (decoded as jwt.JwtPayload).id as string } })
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
            const messages = await prisma.message.findMany({
                where: { OR: [{ from: user.username }, { to: user.username }] },
                select: { from: true, to: true }
            })
            const usernames = new Set(messages.map(m => (m.from === user.username ? m.to : m.from)))
            const users = await prisma.user.findMany({
                where: { username: { in: Array.from(usernames) } },
                select: { id: true, username: true, displayName: true }
            })
            callback({ success: true, users })
        } catch {
            callback({ error: "Failed to fetch user list" })
        }
    })

    socket.on("search_users", async (query, callback) => {
        try {
            const user = socket.data.user
            if (!user) return callback({ error: "Unauthorized" })
            if (!query.trim()) return callback({ success: true, users: [] })
            const result = await prisma.user.findFirst({
                where: { username: query, NOT: { username: user.username } },
                select: { id: true, username: true, displayName: true }
            })
            callback({ success: true, users: result ? [result] : [] })
        } catch {
            callback({ error: "Search failed" })
        }
    })

    socket.on("get_messages", async (data, callback) => {
        try {
            const user = socket.data.user
            if (!user) return callback({ error: "Unauthorized" })
            const messages = await prisma.message.findMany({
                where: {
                    OR: [
                        { from: user.username, to: data.username },
                        { from: data.username, to: user.username }
                    ]
                },
                orderBy: { createdAt: "asc" }
            })
            callback({ success: true, messages })
        } catch {
            callback({ error: "Failed to fetch messages" })
        }
    })

    socket.on("send_message", async (data, callback) => {
        const user = socket.data.user
        if (!user) return
        const message = await prisma.message.create({
            data: { from: user.username, to: data.to, text: data.text }
        })
        const receiverSocket = onlineUsers.get(data.to)
        if (receiverSocket) io.to(receiverSocket).emit("receive_message", message)
        socket.emit("receive_message", message)
        if (callback) callback({ success: true })
    })

    socket.on("disconnect", () => {
        const user = socket.data.user
        if (user) {
            onlineUsers.delete(user.username)
            io.emit("user_offline", { id: user.id, username: user.username })
        }
    })
})

server.listen(process.env.PORT || 4000, () => console.log("server running"))
