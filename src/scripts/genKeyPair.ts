import 'dotenv/config'
import { generateKeyPair } from 'crypto'
import { writeFileSync } from 'fs'

export function genKeyPair() {
    generateKeyPair(
        'rsa',
        {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        },
        (err, publicKey, privateKey) => {
            if (err) throw err
            writeFileSync(process.cwd() + '/privatekey.pem', privateKey)
            writeFileSync(process.cwd() + '/publickey.pem', publicKey)
        },
    )
}

if (require.main === module) {
    genKeyPair()
}
