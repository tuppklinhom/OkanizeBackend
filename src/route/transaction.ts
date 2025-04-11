import { response, Router } from 'express';
import { Transaction } from '../model/Transaction';
import KeyPair from '../module/KeyPair';
import jwt, { JwtPayload } from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs'
import { User } from '../model/User';
import { Op, WhereOptions } from 'sequelize';
import { isBooleanObject } from 'util/types';
import { Wallet } from '../model/Wallet';
import { TransactionServices } from '../module/TransactionServices';
import { Category } from '../model/Category';
import { SummaryGroupTransaction } from '../model/SummaryGroupTransaction';
import { CategoryCount } from '../model/CategoryCount';

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
    
            let {amount, note, wallet_id, category_id, type, receipt_image_base64, is_sorted, is_paid} = req.body;
    
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
            if (is_sorted !== true && is_sorted !== false) {
                is_sorted = false;
            } 
            if(is_paid !== true && is_paid !== false) {
                is_paid = true;
            }

            if(category_id){
                console.log("category_id", category_id)
                const count = await CategoryCount.findOne({where: {category_id: category_id, user_id: user.user_id}})
                console.log("count", count)
                if (!count) {
                    await CategoryCount.create({category_id: category_id, user_id: user.user_id, count: 1})
                }else{
                    await CategoryCount.increment(
                        { count: 1 },
                        { where: { category_id: category_id, user_id: user.user_id } }
                    )
                }
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
                receipt_image_base64: receipt_image_base64,
                is_sorted: is_sorted,
                is_paid: is_paid
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

router.post('/update', KeyPair.requireAuth(),async (req, res, next): Promise<any> => {
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

        if(category_id){
            const count = await CategoryCount.findOne({where: {category_id: category_id}})
            if (!count) {
                await CategoryCount.create({category_id: category_id, user_id: user.user_id,count: 1})
            }else{
                await CategoryCount.increment(
                    { count: 1 },
                    { where: { category_id: category_id, user_id: user.user_id } }
                )
            }
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

router.post('/summary/query', KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { userId } = payloadData as JwtPayload;
        const { summaryId, asDebtor, asCreditor, spaceId, allTransactions} = req.body;

        let summaryTransactions = [];

        // Query by specific summary ID if provided
        if (summaryId) {
            const summary = await SummaryGroupTransaction.findOne({ 
                where: { id: summaryId }
            });
            
            if (!summary) {
                return res.status(404).json({ message: 'Summary transaction not found' });
            }
            
            // Only allow access if the user is either the debtor or creditor
            if (summary.user_id !== userId && summary.target_id !== userId) {
                return res.status(403).json({ message: 'Unauthorized to view this summary' });
            }
            
            summaryTransactions.push(summary);
        }
        else {
            // Query by user's role in the transactions
            let whereClause = {} as WhereOptions
            
            if (asDebtor === true && asCreditor === true) {
                // User wants to see transactions where they are either debtor or creditor
                whereClause = {
                    [Op.or]: [
                        { user_id: userId },   // As debtor
                        { target_id: userId }  // As creditor
                    ]
                };
            } else if (asDebtor === true) {
                // User wants to see only transactions where they are the debtor
                whereClause = { user_id: userId };
            } else if (asCreditor === true) {
                // User wants to see only transactions where they are the creditor
                whereClause = { target_id: userId };
            } else {
                // Default: show all transactions the user is involved in
                whereClause = {
                    [Op.or]: [
                        { user_id: userId },
                        { target_id: userId }
                    ]
                };
            }
            
            if (spaceId) {
                whereClause = { ...whereClause,
                                space_id: spaceId
                            }
            }
            summaryTransactions = await SummaryGroupTransaction.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']]
            });
        }
        
        // Enrich the summary transactions with user information and transaction details
        let enrichedSummaryTransactions = await Promise.all(summaryTransactions.map(async (summary) => {
            // Get debtor information
            const debtor = await User.findOne({ 
                where: { user_id: summary.user_id },
                attributes: ['user_id', 'username', 'profile_image_base64'] 
            });
            
            // Get creditor information
            const creditor = await User.findOne({ 
                where: { user_id: summary.target_id },
                attributes: ['user_id', 'username', 'profile_image_base64']
            });
            
            // Get associated transaction IDs
            const transactionIds = summary.transaction_ids as { debtor: number[], creditor: number[] };
            
            // Fetch transaction details for both debtor and creditor
            let debtorTransactions: Transaction[] = [];
            let creditorTransactions:Transaction[]  = [];
            
            if (transactionIds.debtor && transactionIds.debtor.length > 0) {
                debtorTransactions = await Transaction.findAll({
                    where: { 
                        transaction_id: { [Op.in]: transactionIds.debtor },
                        is_paid: false // Only fetch unpaid transactions for debtor
                    }
                });
            }
            
            if (transactionIds.creditor && transactionIds.creditor.length > 0) {
                creditorTransactions = await Transaction.findAll({
                    where: { 
                        transaction_id: { [Op.in]: transactionIds.creditor },
                        is_paid: false // Only fetch unpaid transactions for creditor
                    }
                });
            }
            
            // Calculate payment status based on related transactions
            let isPaid, role;
            if (userId === summary.user_id) {
                // User is the debtor - status depends on their transactions
                role = 'debtor';
                isPaid = debtorTransactions.every(transaction => transaction.is_paid);
            } else if (userId === summary.target_id) {
                // User is the creditor - status depends on their transactions
                role = 'creditor';
                isPaid = creditorTransactions.every(transaction => transaction.is_paid);
            } else {
                // Fallback case (shouldn't happen due to earlier authorization)
                isPaid = false;
            }

            const createdDate = new Date(summary.createdAt);
            const currentDate = new Date();
            const ageInMonths = (currentDate.getFullYear() - createdDate.getFullYear()) * 12 + 
                   (currentDate.getMonth() - createdDate.getMonth());

            
            return {
                id: summary.id,
                description: summary.description,
                amount: summary.amount,
                status: isPaid ? 'Paid' : 'Pending',
                ageInMonths: ageInMonths,
                isPaid: isPaid,
                role: role,
                createdAt: summary.createdAt,
                debtor: {
                    id: debtor?.user_id,
                    username: debtor?.username,
                    profile: debtor?.profile_image_base64
                },
                creditor: {
                    id: creditor?.user_id,
                    username: creditor?.username,
                    profile: creditor?.profile_image_base64
                },
                transactions: {
                    debtor: debtorTransactions.map(t => ({
                        id: t.transaction_id,
                        amount: t.amount,
                        date: t.date,
                        note: t.note,
                        isPaid: t.is_paid
                    })),
                    creditor: creditorTransactions.map(t => ({
                        id: t.transaction_id,
                        amount: t.amount,
                        date: t.date,
                        note: t.note,
                        isPaid: t.is_paid
                    }))
                }
            };
        }));

        if (allTransactions !== true) {
            enrichedSummaryTransactions = enrichedSummaryTransactions.filter(summary => {
                // Keep the transaction if:
                // 1. It's not paid, OR
                // 2. It's paid but less than a month old
                return !summary.isPaid || summary.ageInMonths < 1;
            });
        }
        
        return res.status(200).json(enrichedSummaryTransactions);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/summary/mark_paid', KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { userId } = payloadData as JwtPayload;
        const { summaryId } = req.body;

        if (!summaryId) {
            return res.status(400).json({ message: 'Summary ID is required' });
        }

        // Find the summary transaction
        const summary = await SummaryGroupTransaction.findOne({
            where: { id: summaryId }
        });

        if (!summary) {
            return res.status(404).json({ message: 'Summary transaction not found' });
        }

        // Determine if the user is the debtor or creditor
        const isDebtor = summary.user_id === userId;
        const isCreditor = summary.target_id === userId;

        if (!isDebtor && !isCreditor) {
            return res.status(403).json({ message: 'Unauthorized to update this summary' });
        }

        // Get the transaction IDs relevant to the user
        const transactionIds = summary.transaction_ids as { debtor: number[], creditor: number[] };
        let relevantTransactionIds: any = [];


        if (isDebtor) {
            // If user is debtor, update their expense transactions
            relevantTransactionIds = transactionIds.debtor || [];
        } else if (isCreditor) {
            // If user is creditor, update their income transactions
            relevantTransactionIds = transactionIds.creditor || [];
        }

        if (relevantTransactionIds.length === 0) {
            return res.status(400).json({ message: 'No transactions found for this user' });
        }

        console.log('Marking transactions as paid:', relevantTransactionIds);

        // Update all relevant transactions to mark them as paid
        await Transaction.update(
            { is_paid: true },
            { where: { transaction_id: { [Op.in]: relevantTransactionIds } } }
        );

        // If both the debtor and creditor have confirmed, we might also want to update
        // the other party's transactions. For now, we'll just update the requester's transactions.

        // Get the updated transactions to return in the response
        const updatedTransactions = await Transaction.findAll({
            where: { transaction_id: { [Op.in]: relevantTransactionIds } }
        });

        return res.status(200).json({
            message: `${isDebtor ? 'Debt' : 'Payment'} marked as paid successfully`,
            summaryId: summary.id,
            userRole: isDebtor ? 'debtor' : 'creditor',
            updatedTransactions: updatedTransactions.map(t => ({
                id: t.transaction_id,
                amount: t.amount,
                note: t.note,
                date: t.date,
                isPaid: t.is_paid
            }))
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;