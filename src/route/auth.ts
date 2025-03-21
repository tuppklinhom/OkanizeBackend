import { Router } from 'express';
import KeyPair from '../module/KeyPair';
import { User } from '../model/User';
import { Wallet } from '../model/Wallet';
import jwt from 'jsonwebtoken'

const router = Router();

router.post('/login', async (req, res) => {
    try{
        const payload = req.body.liffToken
        if (!payload) throw new Error('invalidToken')

        console.log({lifftoken: payload})
        const jwt = payload.split('.')
        const payloadBody = JSON.parse(Buffer.from(jwt[1], 'base64').toString('utf8'))
        const urlencoded = new URLSearchParams()
        urlencoded.append('id_token', payload)
        urlencoded.append('client_id', process.env.LINE_CHANNEL_ID || "2007080121")

        const isError = await fetch('https://api.line.me/oauth2/v2.1/verify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: urlencoded,
        })
            .then((response) => response.json())
            .then((result) => {
                console.log(result)
                return result.error
            })
            .catch((error) => console.error(error))

        if (isError) {
            throw new Error('invalidToken')
        }

        let userObj = await User.findOne({ where: { line_id: payloadBody.sub } })
        if (!userObj) {
            //new user
            userObj = await User.create({
                line_id: payloadBody.sub,
                profile_image_base64: payloadBody.picture
            })

            const wallet = await Wallet.create({
                user_id: userObj.user_id,
                wallet_name: `กระเป๋าตังของ ${payloadBody.name}`,
                wallet_type: "Cash"
            })

            await userObj.update({default_wallet: wallet.wallet_id})
            await userObj.save()

            console.log('created new User', userObj.dataValues)
        }else{
            userObj.update({profile_image_base64: payloadBody.picture})
            await userObj.save()
        }
        const userJSON = {
            userId: userObj.user_id,
            username: userObj.username,
            profileImage: userObj.profile_image_base64,
            iat: Date.now(),
            exp: Date.now() + 1000 * 60 * 5,
        }
        res.status(200).json({
            accessToken: KeyPair.signJWT(userJSON),
            isUsernameSetted: userObj.username? true : false
        })
    }catch(error){
        console.log(error);
        res.status(400).json({error: "invalidToken"})
    }

})

router.post('/confirm_username', KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try{
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        console.log(payloadData)

        const username = req.body.username
        const user = await User.findOne({where: {user_id: payloadData.userId}})
        const userChecker = await User.findOne({where: {username: username}})
        if (!user){
            return res.status(400).json({ message: 'Invalid token: no user' });
        }
        if(userChecker){
            return res.status(400).json({ message: 'This Username is Already Taken' });
        }else{
            await user.update({username})
            await user.save()
            return res.status(200).json(user)
        }
        
    }catch(error){
        res.status(400).json({error: error})
    }
})

export default router;