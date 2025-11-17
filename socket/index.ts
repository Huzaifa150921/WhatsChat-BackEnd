import { Server } from "socket.io"
import { prisma } from "../prisma/client.js"
import { socketAuth } from "../middleware/socketAuth.js"

export function initSocket(io: Server) {
    const onlineUsers = new Map<string, string>()

    io.on("connection", async (socket) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(" ")[1]

        if (!token) return socket.disconnect()

        socket.data.token = token

        socketAuth(socket, async (err) => {
            if (err) return socket.disconnect()

            const user = socket.data.user

            await prisma.user.update({
                where: { username: user.username },
                data: { online: true },
            })

            onlineUsers.set(user.username, socket.id)

            const onlineFromDB = await prisma.user.findMany({ where: { online: true } })
            io.emit("online_users", onlineFromDB.map(u => u.username))

            socket.on("send_message", async (data, callback) => {
                socket.data.token = data.token
                socketAuth(socket, async (err) => {
                    if (err) return callback({ error: "Unauthorized" })
                    try {
                        const message = await prisma.message.create({
                            data: { from: user.username, to: data.to, text: data.text, status: "sent" },
                        })
                        const receiverSocket = onlineUsers.get(data.to)
                        if (receiverSocket) io.to(receiverSocket).emit("receive_message", message)
                        callback({ success: true })
                    } catch {
                        callback({ error: "Message failed" })
                    }
                })
            })

            socket.on("disconnect", async () => {
                for (const [username, id] of onlineUsers.entries()) {
                    if (id === socket.id) {
                        onlineUsers.delete(username)
                        await prisma.user.update({
                            where: { username },
                            data: { online: false },
                        })
                        const onlineFromDB = await prisma.user.findMany({ where: { online: true } })
                        io.emit("online_users", onlineFromDB.map(u => u.username))
                        break
                    }
                }
            })
        })
    })
}
