import { Socket } from "socket.io"
import jwt from "jsonwebtoken"
import { JWT_SECRET, DecodedToken } from "./verifyToken.js"

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
    const token = socket.data?.token || socket.handshake.auth?.token
    if (!token) return next(new Error("No token provided"))
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
        socket.data.user = decoded
        next()
    } catch {
        next(new Error("Invalid token"))
    }
}
