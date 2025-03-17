import { response, Router } from 'express';
import { Transaction } from '../model/Transaction';
import KeyPair from '../module/KeyPair';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs'
import { User } from '../model/User';
import { Op, WhereOptions } from 'sequelize';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/create', KeyPair.requireAuth(), upload.single('receipt_image'),async (req, res, next): Promise<any> =>  {
        try{
            const token = req.headers['access-token'] as string;
            const payloadData = jwt.decode(token);
            if (typeof payloadData === 'string' || !payloadData) {
                return res.status(400).json({ message: 'Invalid token' });
            }

            const user = await User.findOne({where: {user_id: payloadData.userId}})

            if (!user){
                return res.status(400).json({message: "User Not Found."})
            }
    
            let {amount, note, wallet_id, category_id, type, receipt_image_base64} = req.body;
    
            if (!amount) {
                return res.status(400).json({ message: 'Invalid input amount' });
            }        
            if (!wallet_id) {
                wallet_id = user.default_wallet
            }
            if (!category_id) {
                category_id = user.default_category
            }
            if (!type || (type !== 'Expense' && type !== 'Income')) {
                return res.status(400).json({ message: 'Invalid input type' });
            }
            if (receipt_image_base64 && typeof receipt_image_base64 !== 'string') {
                return res.status(400).json({ message: 'Invalid input receipt_image_base64' });
            }

            if (req.file) {
                const filePath = req.file.path;
                const fileBuffer = fs.readFileSync(filePath);
                receipt_image_base64 = fileBuffer.toString('base64');
                fs.unlinkSync(filePath); // Delete the file after converting to base64
            }

    
            const transaction = await Transaction.create({
                amount: amount,
                wallet_id: wallet_id,
                category_id: category_id,
                note: note,
                type: type,
                date: new Date(),
            });
            return res.status(200).json(transaction)
    
        }catch(error){
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
})

router.post('/query', KeyPair.requireAuth(),async (req, res, next): Promise<any> => {
    try{
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        const user = await User.findOne({where: {user_id: payloadData.userId}})
        if (!user){
            return res.status(400).json({message: "User Not Found."})
        }

        let whereClause: WhereOptions = {}

        const reqBody = req.body
        

        if (reqBody.wallet_id) {
            whereClause.wallet_id = reqBody.wallet_id;
        }
        if (reqBody.category_id) {
            whereClause.category_id = reqBody.category_id;
        }
        if (reqBody.type) {
            whereClause.type = reqBody.type;
        }
        if (reqBody.minAmount) {
            whereClause.amount = { ...whereClause.amount, [Op.gte]: reqBody.minAmount };
        }
        if (reqBody.maxAmount) {
            whereClause.amount = { ...whereClause.amount, [Op.lte]: reqBody.maxAmount };
        }
        if (reqBody.isSorted) {
            whereClause
        }

        const transactions = await Transaction.findAll({
            where: whereClause,
            order: [['date', 'DESC']]
        });


        return res.status(200).json({transactions})

    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }

})


export default router;