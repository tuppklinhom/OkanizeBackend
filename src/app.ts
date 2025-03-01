import express, { Request, Response, NextFunction, urlencoded, json } from 'express'
export const app = express();

app.use(json())

app.get('/health', (req, res) => {
    res.status(200).json({
        status: res.statusCode,
        message: 'have a good day',
    })
})



app.use('*', (req, res, next) => {
    res.status(404)
    throw new Error('not found')
})
