import express, { json } from 'express'
import bodyParser from "body-parser";
import ocrRouter from './route/ocr'
import groupRouter from './route/group'
import transactionRouter from './route/transaction'
import authRouter from './route/auth'

export const app = express();

app.use(json())
app.use(bodyParser.json({ limit: "10mb" })); // Support JSON body with base64 images
app.use(bodyParser.urlencoded({ extended: true }));

const apifunc = (req:any, res:any) => {
    res.status(200).json({
        status: res.statusCode,
        message: 'api ok',
    })
}

app.get('/',apifunc)
app.get('/api',apifunc)

app.get('/health', (req, res) => {
    res.status(200).json({
        status: res.statusCode,
        message: 'have a good day',
    })
})


app.use('/api/ocr', ocrRouter)
app.use('/api/group', groupRouter)
app.use('/api/transaction', transactionRouter)
app.use('/api/auth', authRouter)

app.use('*', (req, res, next) => {
    res.status(404)
    throw new Error('not found')
})
