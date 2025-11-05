import { Request } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"
import dotenv from "dotenv"

dotenv.config()
const JWT_SECRET = process.env.JWT_SECRET as string
if (!JWT_SECRET) throw new Error("JWT_SECRET not found in .env")

type DecodedToken = JwtPayload & { id: string; username: string }

export function verifyToken(req: Request): DecodedToken | null {
    const auth = req.headers.authorization
    if (!auth) return null
    try {
        const token = auth.split(" ")[1]
        return jwt.verify(token, JWT_SECRET) as DecodedToken
    } catch {
        return null
    }
}

export { JWT_SECRET, DecodedToken }
