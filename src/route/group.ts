import { Router } from 'express';
import KeyPair from '../module/KeyPair';
import { GroupMember } from '../model/GroupMember';
import { GroupSpace } from '../model/GroupSpace';
import jwt, { JwtPayload } from 'jsonwebtoken'; 
import { User } from '../model/User';
import { Transaction } from '../model/Transaction';
import { GroupTransaction } from '../model/GroupTransaction';

const router = Router();    

router.post('/create', KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);

        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { userId } = payloadData as JwtPayload;

        const { groupName, groupDescription, userInviteList } = req.body;

        let userList = []

        const group = await GroupSpace.create({
            name: groupName,
            description: groupDescription,
        });

        await GroupMember.create({
            space_id: group.space_id,
            user_id: userId,
            role: 'Admin',
        });

        for (const user of userInviteList) {
            const userObj = await User.findOne({ where: { user_id: user } });

            if (userObj){
                userList.push({name: userObj.name, email: userObj.email});
                await GroupMember.create({
                    space_id: group.space_id,
                    user_id: userObj.user_id,
                    role: 'Member',
                });
            }
        }

        return res.status(201).json({ 
            group_space_id: group.space_id,
            group_name: group.name,
            group_description: group.description,
            user_list: userList,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/invite', (req, res) => {

})

router.post('/accept', (req, res) => {

})

router.get('/query', KeyPair.requireAuth() ,async (req, res, next): Promise<any> => {
    try{
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);

        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { userId } = payloadData as JwtPayload;

        const myGroupList = await GroupMember.findAll({
            where: { user_id: userId },
        });

        const groupListObj = await Promise.all(myGroupList.map(async (group) => {
            
            const groupObj = await GroupSpace.findOne({ where: { space_id: group.space_id } });

            const groupMemberList = await GroupMember.findAll({ where: { space_id: group.space_id } });
            const groupMembers = await Promise.all(groupMemberList.map(async (member) => {
                return await User.findOne({ where: { user_id: member.user_id }, attributes: ['name', 'email'] });
            }))
            if (!groupObj) {
                return null
            }
            return {groupName: groupObj.name, groupDescription: groupObj.description, groupMember: groupMembers};
        }))


        return res.status(200).json(groupListObj);

    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
    

})

router.post('/transaction/create', KeyPair.requireAuth() ,async (req, res, next): Promise<any> => {
    try{
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const {groupSpaceID, amount, note} = req.body;

        if (!groupSpaceID || !amount || !note) {
            return res.status(400).json({ message: 'Invalid input' });
        }
        const group = await GroupSpace.findOne({ where: { space_id: groupSpaceID } });
        if (!group) {
            return res.status(400).json({ message: 'Group not found' });
        }

        const memberCheck = await GroupMember.findOne({ where: { space_id: groupSpaceID, user_id: payloadData.userId } });
        if (!memberCheck) {
            return res.status(400).json({ message: 'Invalid Command' });
        }

        const transaction = await Transaction.create({
            amount: amount,
            note: note,
            type: 'Expense',
            date: new Date(),
        });

        const groupTransaction = await GroupTransaction.create({
            space_id: groupSpaceID,
            transaction_id: transaction.transaction_id,
            description: note,
            split_member: {}
        })

        return res.status(200).json({
            groupTransactionID: groupTransaction.group_transaction_id,
            spaceID: groupSpaceID, 
            spaceName: group.name,
            transaction: transaction.dataValues
        })

    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/transaction/query', KeyPair.requireAuth() ,async (req, res, next): Promise<any>=> {
    try{
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const {groupTransactionID, groupSpaceID} = req.body;
        if (!groupSpaceID){
            return res.status(400).json({ message: 'Invalid input groupSpaceID' });
        }

        let groupTransactionList = []

        if (!groupTransactionID){
            groupTransactionList = await GroupTransaction.findAll({ where: { space_id: groupSpaceID } });
        }else{
            groupTransactionList = await GroupTransaction.findAll({ where: { group_transaction_id: groupTransactionID } });
        }

        const transactionList = await Promise.all(groupTransactionList.map(async (groupTransaction) => {
            const transaction = await Transaction.findOne({ where: { transaction_id: groupTransaction.transaction_id } });
            return {groupTransactionID: groupTransaction.group_transaction_id, description: groupTransaction.description ,transaction: transaction?.dataValues};
        }))

        return res.status(200).json(transactionList)
    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/transaction/split', (req, res) => {

})

router.post('/transaction/confirm', (req, res) => {

})
export default router;