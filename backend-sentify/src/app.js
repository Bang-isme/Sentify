require('dotenv').config()

const cors = require('cors')
const express = require('express')

const authRoutes = require('./routes/auth')

const app = express()

app.use(
    cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    }),
)
app.use(express.json())

app.get('/', (req, res) => {
    return res.status(200).json({
        service: 'backend-sentify',
        status: 'ok',
    })
})

app.get('/health', (req, res) => {
    return res.status(200).json({ status: 'ok' })
})

app.get('/api/health', (req, res) => {
    return res.status(200).json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)

module.exports = app
