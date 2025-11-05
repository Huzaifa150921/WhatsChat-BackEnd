import { Router } from "express"
import { prisma } from "../prisma/client.js"
import { verifyToken } from "../middleware/verifyToken.js"

const router = Router()

router.get("/", async (req, res) => {
    try {
        const decoded = verifyToken(req)
        if (!decoded) return res.status(401).json({ error: "Unauthorized" })
        const messages = await prisma.message.findMany({
            where: { OR: [{ from: decoded.username }, { to: decoded.username }] },
            select: { from: true, to: true },
        })
        const usernames = Array.from(new Set(messages.map(m => (m.from === decoded.username ? m.to : m.from))))
        const users = await prisma.user.findMany({
            where: { username: { in: usernames } },
            select: { id: true, username: true, displayName: true },
        })
        res.json({ success: true, users })
    } catch {
        res.status(500).json({ error: "Failed to fetch users" })
    }
})

router.get("/search", async (req, res) => {
    try {
        const decoded = verifyToken(req)
        if (!decoded) return res.status(401).json({ error: "Unauthorized" })
        const query = typeof req.query.q === "string" ? req.query.q.trim() : ""
        if (!query) return res.json({ success: true, users: [] })
        const users = await prisma.user.findMany({
            where: {
                username: { contains: query, mode: "insensitive" },
                NOT: { username: decoded.username },
            },
            select: { id: true, username: true, displayName: true },
        })
        res.json({ success: true, users })
    } catch {
        res.status(500).json({ error: "Search failed" })
    }
})

export default router
