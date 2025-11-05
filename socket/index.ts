import { Server } from "socket.io"
import { prisma } from "../prisma/client.js"
import { JWT_SECRET, DecodedToken } from "../middleware/verifyToken.js"
import jwt from "jsonwebtoken"

export function initSocket(io: Server) {
    const onlineUsers = new Map<string, string>()

    io.use((socket, next) => {
        const token = socket.handshake.auth?.token
        if (!token) return next(new Error("No token"))
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
            socket.data.user = decoded
            next()
        } catch {
            next(new Error("Invalid token"))
        }
    })

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id)
        const user = socket.data.user
        if (!user) return socket.disconnect()
        onlineUsers.set(user.username, socket.id)
        io.emit("user_online", { id: user.id, username: user.username })

        socket.on("authenticate", async (data, callback) => {
            const token = data?.token
            if (!token) return callback({ error: "No token provided" })
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
                const dbUser = await prisma.user.findUnique({
                    where: { username: decoded.username },
                    select: { id: true, username: true, displayName: true }
                })
                if (!dbUser) return callback({ error: "User not found" })
                socket.data.user = dbUser
                callback({ success: true, user: dbUser })
            } catch {
                callback({ error: "Invalid token" })
            }
        })

        socket.on("send_message", async (data: { to: string; text: string }, callback) => {
            try {
                const message = await prisma.message.create({
                    data: { from: user.username, to: data.to, text: data.text },
                })
                const receiverSocket = onlineUsers.get(data.to)
                if (receiverSocket) io.to(receiverSocket).emit("receive_message", message)
                callback({ success: true })
            } catch {
                callback({ error: "Message failed" })
            }
        })

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id)
            onlineUsers.delete(user.username)
            io.emit("user_offline", { id: user.id, username: user.username })
        })
    })
}
