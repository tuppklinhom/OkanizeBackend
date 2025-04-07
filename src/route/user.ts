import { Router } from 'express';
import { Wallet } from '../model/Wallet';
import { Category } from '../model/Category';
import { Op, WhereOptions } from 'sequelize';
import { Transaction } from '../model/Transaction';
import KeyPair from '../module/KeyPair';
import jwt from 'jsonwebtoken';
import { UserBudgetLimit } from '../model/UserBudgetLimit';
import { parse } from 'path';
import { Where } from 'sequelize/types/utils';
import { User } from '../model/User';
import { sequelize } from '../database';

const router = Router();

/**
 * CATEGORY ROUTES
 */
// Create Category
router.post('/category/create', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        const {name, budgetLimit, imageBase64, type } = req.body;
        const category = await Category.create({ user_id: payloadData.userId, name: name,type: type, image_base64: imageBase64 });
        if(budgetLimit){
            const budgetLimitObj = await UserBudgetLimit.create({user_id: payloadData.userId, category_id: category.category_id, budget_limit: budgetLimit})
            res.status(201).json({
                ...category.dataValues,
                budget_limit: budgetLimitObj.budget_limit
            });
        }else{
            res.status(201).json({
                ...category.dataValues,
                budget_limit: 0
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category', details: error });
    }
});

// Query Categories (fetch both personal and common)
router.get('/category/query', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const isDefaultOnly = req.query.defaultOnly === 'true';
        
        let whereClause: WhereOptions = {}

        if(isDefaultOnly){
            whereClause = { user_id: null }
        }else{
            whereClause = { [Op.or]: [{ user_id: payloadData.userId }, { user_id: null }] }
        }
        const categories = await Category.findAll({
            where: whereClause,
            order: [
            [
                sequelize.literal(`
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM CategoryCount 
                     WHERE CategoryCount.category_id = Category.category_id), 
                    0
                )
                `), 
                'DESC'
            ]
            ],
        });

        const categoriesWithBudgetLimit = await Promise.all(categories.map(async (category) => {
            const budgetLimitObj = await UserBudgetLimit.findOne({where: {category_id: category.category_id, user_id: payloadData.userId}}) 
            return {
                ...category.dataValues,
                budget_limit: budgetLimitObj? budgetLimitObj.budget_limit : 0
            }
        }
        ));
        res.json(categoriesWithBudgetLimit);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories', details: error });
    }
});

// Update Category
router.post('/category/update', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        let { categoryID, name, budget_limit, type, imageBase64 } = req.body;

        // First, check if this is a user category or a default category
        const userCategory = await Category.findOne({ 
            where: { category_id: categoryID, user_id: payloadData.userId } 
        });

        const defaultCategory = await Category.findOne({ 
            where: { category_id: categoryID, user_id: null } as any // Using 'as any' to bypass TypeScript error
        });

        // Get the budget limit regardless of category type
        let budgetLimitObj = await UserBudgetLimit.findOne({
            where: { category_id: categoryID, user_id: payloadData.userId }
        });

        // If neither user category nor default category exists, return error
        if (!userCategory && !defaultCategory) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Get the category to use (either user or default)
        const category = userCategory || defaultCategory;

        // Handle budget limit changes (for both user and default categories)
        if (typeof budget_limit === 'number') {
            if (budgetLimitObj) {
                if (budget_limit === 0) {
                    await budgetLimitObj.destroy();
                    budgetLimitObj = null;
                } else {
                    await budgetLimitObj.update({ budget_limit: budget_limit });
                    await budgetLimitObj.save();
                }
            } else if (budget_limit > 0) {
                budgetLimitObj = await UserBudgetLimit.create({
                    category_id: categoryID,
                    user_id: payloadData.userId,
                    budget_limit: budget_limit
                });
            }
        }

        // Only update the category itself if it's a user category
        if (userCategory) {
            if (!name) {
                name = category?.name;
            }
            if (!type) {
                type = category?.type;
            }
            if (!imageBase64) {
                imageBase64 = category?.image_base64;
            }
        
            await userCategory.update({ name, type, image_base64: imageBase64 });
            await userCategory.save();
        }

        // Return the category data with budget_limit
        res.json({
            ...category?.dataValues,
            budget_limit: budgetLimitObj ? budgetLimitObj.budget_limit : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update category', details: error });
    }
});

// Delete Category
router.delete('/category/delete', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        const { categoryID } = req.body;
        const deleted = await Category.destroy({ where: { category_id: categoryID, user_id: payloadData.userId  } });

        if (!deleted) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category', details: error });
    }
});

/**
 * WALLET ROUTES
 */
// Create Wallet
router.post('/wallet/create', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { walletName, walletType, initialAmount } = req.body;

        if (walletType != "Cash" && walletType != "Credit Card" && walletType != "Bank Transfer"){
            return res.status(400).json({message: "invalid wallet type"})
        }
        if (typeof initialAmount != "number"){
            return res.status(400).json({message: "invalid initial amount"})
        }
        
        
        const wallet = await Wallet.create({ user_id: payloadData.userId, wallet_name: walletName, wallet_type: walletType});
        const transaction = await Transaction.create({ wallet_id: wallet.wallet_id, category_id: null, amount: initialAmount, type: "initial", is_sorted: true, is_paid: true, note: "Initial Amount For Wallet: " + walletName, date: new Date() });
        res.status(201).json({...wallet.dataValues, sumPrice: initialAmount});
    } catch (error) {
        res.status(500).json({ error: 'Failed to create wallet', details: error });
    }
});

// Query Wallets
router.get('/wallet/query', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        const wallets = await Wallet.findAll({ where: { user_id: payloadData.userId } });
        
        const walletWithSumPrice = await Promise.all(wallets.map(async (wallet) => {
            const transactions = await Transaction.findAll({ where: { wallet_id: wallet.wallet_id } });
            
            const sumPrice = transactions.reduce((sum, transaction) => {
                if (transaction.type === 'Expense') {
                    return sum - parseFloat(transaction.amount as unknown as string);
    
                }else{
                    return sum + parseFloat(transaction.amount as unknown as string);
                }
    
            }, 0);

            return {
                ...wallet.dataValues,
                sum_price: sumPrice
            }
        }))


        res.json(walletWithSumPrice);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallets', details: error });
    }
});


// Query Wallets by ID
router.get('/wallet/query/:id', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        if (req.params.id == null || req.params.id == undefined || Number.isNaN(req.params.id)){
            return res.status(400).json({ message: 'Invalid wallet id' });
        }
        const wallet = await Wallet.findOne({ where: { wallet_id: parseInt(req.params.id), user_id: payloadData.userId } });

        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        const transactions = await Transaction.findAll({ where: { wallet_id: wallet.wallet_id } });
            
        const sumPrice = transactions.reduce((sum, transaction) => {
            if (transaction.type === 'Expense') {
                return sum - parseFloat(transaction.amount as unknown as string);

            }else{
                return sum + parseFloat(transaction.amount as unknown as string);
            }

        }, 0);

        res.json({
            ...wallet.dataValues,
            sum_price: sumPrice
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallets', details: error });
    }
});


// Update Wallet
router.post('/wallet/update', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        let { walletID, walletName, walletType } = req.body;
        const wallet = await Wallet.findOne({ where: { wallet_id: walletID, user_id: payloadData.userId } });
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

        if(!walletName){
            walletName = wallet.wallet_name
        }if(!walletType){
            walletType = wallet.wallet_type
        }

        await wallet.update({ wallet_name: walletName, wallet_type:walletType });
        await wallet.save()
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update wallet', details: error });
    }
});

// Delete Wallet
router.delete('/wallet/delete', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        const { walletID } = req.body;
        const deleted = await Wallet.destroy({ where: { wallet_id: walletID, user_id: payloadData.userId  } });

        if (!deleted) return res.status(404).json({ error: 'Wallet not found' });
        res.json({ message: 'Wallet deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete wallet', details: error });
    }
});

router.post('/profile', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        let { defaultWallet, defaultCategory, username } = req.body;

        if(defaultWallet){
            const wallet = await Wallet.findOne({ where: { wallet_id: defaultWallet, user_id: payloadData.userId } });
            if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
        }

        if(defaultCategory){
            const category = await Category.findOne({ where: { category_id: defaultCategory, user_id:{[Op.or]: [payloadData.userId, null]}} });
            if (!category) return res.status(404).json({ error: 'Category not found' });
        }

        if(username){
            const checkUsername = await User.findOne({where: {username: username}})
            if(checkUsername){
                return res.status(400).json({message: "Username already exist"})
            }
        }

        const user = await User.findOne({where: {user_id: payloadData.userId}})
        if (!user) return res.status(404).json({ error: 'User not found' });

        await user.update({default_wallet: defaultWallet, default_category: defaultCategory, username: username});
        await user.save()

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update wallet', details: error });
    }
});

router.get('/profile/:id', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        
        const user = await User.findOne({where: {user_id: req.params.id}})
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update wallet', details: error });
    }
});

export default router;