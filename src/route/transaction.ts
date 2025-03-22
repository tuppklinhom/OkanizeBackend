import { response, Router } from 'express';
import { Transaction } from '../model/Transaction';
import KeyPair from '../module/KeyPair';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs'
import { User } from '../model/User';
import { Op, WhereOptions } from 'sequelize';
import { isBooleanObject } from 'util/types';
import { Wallet } from '../model/Wallet';
import { TransactionServices } from '../module/TransactionServices';
import { Category } from '../model/Category';

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

    
            const transaction = await TransactionServices.createTransactionWithNotification(user.user_id, {
                amount: amount,
                wallet_id: wallet_id,
                category_id: category_id,
                note: note,
                type: type,
                receipt_image_base64: receipt_image_base64
            })
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
            whereClause.is_sorted = reqBody.isSorted;
        }
        if (reqBody.isPaid){
            whereClause.is_paid = reqBody.isPaid;
        }

        if (!reqBody.wallet_id && !reqBody.category_id){
            const wallets = await Wallet.findAll({where: {user_id: user.user_id}})
            const walletIds = wallets.map(wallet => wallet.wallet_id) 
            whereClause.wallet_id = {[Op.in]: walletIds}
        }

        const transactions = await Transaction.findAll({
            where: whereClause,
            order: [['date', 'DESC']]
        });

        const sumPrice = transactions.reduce((sum, transaction) => {
            return sum + parseFloat(transaction.amount as unknown as string);
        }, 0);

        const transactionsWithNames = await Promise.all(transactions.map(async (transaction) => {
            const wallet = await Wallet.findOne({where: {wallet_id: transaction.wallet_id}});
            if(transaction.category_id){
                const category = await Category.findOne({where: {category_id: transaction.category_id}});
                return {
                    ...transaction.toJSON(),
                    wallet_name: wallet?.wallet_name,
                    category_name: category?.name
                }
            }else{
                return {
                    ...transaction.toJSON(),
                    wallet_name: wallet?.wallet_name
                }

            }
        }
        ));

        return res.status(200).json({
            sumPrice: sumPrice,
            transactionsList: transactionsWithNames
        })

    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }

})

router.patch('/update', KeyPair.requireAuth(),async (req, res, next): Promise<any> => {
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

        const transaction_id = req.body.transaction_id
        const transaction = await Transaction.findOne({where: {transaction_id: transaction_id}})
        if (!transaction){
            return res.status(400).json({message: "Transaction Not Found."})
        }

        let {wallet_id, category_id, type, isSorted, isPaid, amount, note} = req.body
        
        if (!amount) {
            amount = transaction.amount;
        }
        if (!wallet_id) {
            wallet_id = transaction.wallet_id;
        }
        if (!category_id) {
            category_id = transaction.category_id;
        }
        if (!type) {
            type = transaction.type;
        }
        if (!note) {
            note = transaction.note;
        }
        if (isSorted !== true && isSorted !== false) {
            isSorted = transaction.is_sorted;   
        }
        if (isPaid !== true && isPaid !== false) {
            isPaid = transaction.is_paid;   
        }

        const transactionEdited = await TransactionServices.updateTransactionWithNotification(user.user_id, transaction.transaction_id,{
            amount: amount,
            wallet_id: wallet_id,
            category_id: category_id,
            type: type,
            isSorted: isSorted,
            isPaid: isPaid,
            note: note
            });


        return res.status(200).json(transactionEdited)

    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }

})


router.delete('/delete', KeyPair.requireAuth(),async (req, res, next): Promise<any> => {
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

        const transaction_id = req.body.transaction_id
        const transaction = await Transaction.findOne({where: {transaction_id: transaction_id}})
        if (!transaction){
            return res.status(400).json({message: "Transaction Not Found."})
        }

        const wallet = await Wallet.findOne({where: {wallet_id: transaction.wallet_id}})
        if (!wallet){
            return res.status(400).json({message: "Wallet Not Found."})
        }

        if(wallet.user_id !== user.user_id){
            return res.status(400).json({message: "This wallet is not belong to this user."})
        }

        const transactionEdited = await Transaction.destroy({
            where: {transaction_id: transaction_id}
        });

        return res.status(200).json(transactionEdited)

    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }

})

export default router;