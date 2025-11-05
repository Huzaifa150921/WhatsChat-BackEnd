import { Router } from "express"
import { prisma } from "../prisma/client.js"
import { verifyToken } from "../middleware/verifyToken.js"

const router = Router()

router.get("/:username", async (req, res) => {
    try {
        const decoded = verifyToken(req)
        if (!decoded) return res.status(401).json({ error: "Unauthorized" })
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { from: decoded.username, to: req.params.username },
                    { from: req.params.username, to: decoded.username },
                ],
            },
            orderBy: { createdAt: "asc" },
        })
        res.json({ success: true, messages })
    } catch {
        res.status(500).json({ error: "Failed to fetch messages" })
    }
})

export default router
