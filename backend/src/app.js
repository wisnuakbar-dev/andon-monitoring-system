import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import { CLIENT_URL, NODE_ENV } from './config/index.js'
import indexRouter from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.middleware.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: CLIENT_URL, credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

if (NODE_ENV === 'development') {
  app.use(morgan('dev'))
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', indexRouter)

app.use(notFound)
app.use(errorHandler)

export default app