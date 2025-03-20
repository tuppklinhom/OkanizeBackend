import { Router } from 'express';
import { Wallet } from '../model/Wallet';
import { Category } from '../model/Category';
import { Op } from 'sequelize';
import KeyPair from '../module/KeyPair';
import jwt from 'jsonwebtoken';
import { UserBudgetLimit } from '../model/UserBudgetLimit';

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
        
        const categories = await Category.findAll({
            where: {
                [Op.or]: [{ user_id: payloadData.userId }, { user_id: null }]
            }
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
router.patch('/category/update', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        let { categoryID, name, budgetLimit, type, imageBase64 } = req.body;

        const category = await Category.findOne({ where: { category_id: categoryID, user_id: payloadData.userId } });
        let budgetLimitObj =  await UserBudgetLimit.findOne({where: { category_id: categoryID, user_id: payloadData.userId }})

        if (!category) return res.status(404).json({ error: 'Category not found' });

        if(!name){
            name = category.name
        }
        if(!type){
            budgetLimit = category.type
        }
        if(!imageBase64){
            imageBase64 = category.image_base64
        }

        if(budgetLimit){
            if(budgetLimitObj){
                await budgetLimitObj.update({budget_limit: budgetLimit})
                await budgetLimit.save()
            }else{
                budgetLimitObj = await UserBudgetLimit.create({category_id: categoryID, user_id: payloadData.userId, budget_limit: budgetLimit}) 
            }
        }

        await category.update({ name: name, type: type,image_base64: imageBase64 });
        await category.save()
        res.json({
           ...category.dataValues,
           budget_limit: budgetLimitObj?  budgetLimitObj.budget_limit : 0 
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

        const { walletName, walletType } = req.body;

        if (walletType != "Cash" && walletType != "Credis Card" && walletType != "Bank Transfer"){
            return res.status(400).json({message: "invalid wallet type"})
        }
        const wallet = await Wallet.create({ user_id: payloadData.userId, wallet_name: walletName, wallet_type: walletType});
        res.status(201).json(wallet);
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
        res.json(wallets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallets', details: error });
    }
});

// Update Wallet
router.patch('/wallet/update', KeyPair.requireAuth(),async (req, res, next): Promise<any> =>{
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

export default router;