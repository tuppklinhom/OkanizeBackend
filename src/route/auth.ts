import { Router } from 'express';
import KeyPair from '../module/KeyPair';
import { User } from '../model/User';

const router = Router();

router.post('/login', async (req, res) => {
    try{
        const { email, password } = req.body;
    
        const user = await User.findOne({where: {email: email}});
    
        if (user && password === user.password) {
            const token = KeyPair.signJWT({ 
                userId: user.user_id,
                email: user.email,
                name: user.name,
            });
            res.json({ token });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    }catch(error){
        console.log(error);
    }

})



export default router;