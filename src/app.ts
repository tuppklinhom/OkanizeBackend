import express, { json } from 'express'
import bodyParser from "body-parser";
import ocrRouter from './route/ocr'
import groupRouter from './route/group'
import transactionRouter from './route/transaction'
import authRouter from './route/auth'
import userRouter from './route/user'
import friendRouter from './route/friend'
import callbackRouter from './route/callback'
import { configureCors } from './cors-config';


export const app = express();


app.use(bodyParser.json({ limit: "10mb" })); // Support JSON body with base64 images
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));


app.get('/health', (req, res) => {
    res.status(200).json({
        status: res.statusCode,
        message: 'have a good day',
    })
})

configureCors(app)
app.use('/api/callback', callbackRouter)
  
app.use('/api/ocr', ocrRouter)
app.use('/api/group', groupRouter)
app.use('/api/transaction', transactionRouter)
app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)
app.use('/api/friend', friendRouter)

app.use('*', (req, res, next) => {
    res.status(404)
    throw new Error('not found')
})
