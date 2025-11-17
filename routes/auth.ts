import { Router } from "express"
import { prisma } from "../prisma/client.js"
import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../middleware/verifyToken.js"

const router = Router()

router.post("/signup", async (req, res) => {
    try {
        const { displayName, username, password, confirmPassword } = req.body
        if (!displayName || !username || !password || !confirmPassword)
            return res.status(400).json({ error: "All fields required" })
        if (password !== confirmPassword)
            return res.status(400).json({ error: "Passwords do not match" })
        const exists = await prisma.user.findUnique({ where: { username } })
        if (exists) return res.status(400).json({ error: "Username already taken" })
        const user = await prisma.user.create({ data: { displayName, username, password } })
        res.json({ success: true, user })
    } catch {
        res.status(500).json({ error: "Signup failed" })
    }
})

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body
        const user = await prisma.user.findUnique({ where: { username } })
        if (!user || user.password !== password)
            return res.status(400).json({ error: "Invalid credentials" })
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET)
        res.json({ success: true, token, user: { id: user.id, username: user.username, displayName: user.displayName } })
    } catch {
        res.status(500).json({ error: "Login failed" })
    }
})




export default router
