import { Module } from './Module'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { genKeyPair } from '../scripts/genKeyPair'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

export class KeyPair extends Module {
    private _privateKey: string = ''
    private _publicKey: string = ''

    constructor() {
        super()
        this.readingKeypair()
        this.watchFile(
            './privatekey.pem',
            () => (this._privateKey = readFileSync('./privatekey.pem', { encoding: 'utf8' })),
        )
        this.watchFile(
            './publickey.pem',
            () => (this._publicKey = readFileSync('./publickey.pem', { encoding: 'utf8' })),
        )
    }

    private readingKeypair() {
        if (
            !(
                existsSync(path.resolve('./privatekey.pem')) &&
                existsSync(path.resolve('./publickey.pem'))
            )
        ) {
            genKeyPair()
            throw new Error("require PEM files");
        }
        this._privateKey = readFileSync('./privatekey.pem', { encoding: 'utf8' })
        this._publicKey = readFileSync('./publickey.pem', { encoding: 'utf8' })
    }

    public getPublicKey() {
        return this._publicKey
    }

    public signJWT(body: any) {
        return jwt.sign(body, this._privateKey, { algorithm: 'RS256' })
    }

    public verifyJWT (token: any) {
        try {
            return jwt.verify(token, this._publicKey, { algorithms: ['RS256'] }) as JwtPayload
        } catch (error: any) {
            return {
                status: 403,
                message: error.message,
            }
        }
    }

    public requireAuth () {
        return (req: Request, res: Response, next: NextFunction) => {
            try {
                // Using this if accept Authorization
                // const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('Access-Token')
                // Using this if Access-Token
                const token = req.header('Access-Token')
                const result = this.verifyJWT(token)
                console.log(result)
                if (result.status && result.status === 403) { throw result }
                res.locals.user = result
                next()
            } catch (error) {
                res.status(401).json({ status: 401, message: `expiredToken ${error}` })
            }
        }
    }
}

export default new KeyPair()
