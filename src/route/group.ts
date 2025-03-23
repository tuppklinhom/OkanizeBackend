import { Router } from 'express';
import KeyPair from '../module/KeyPair';
import { GroupMember } from '../model/GroupMember';
import { GroupSpace } from '../model/GroupSpace';
import jwt, { JwtPayload } from 'jsonwebtoken'; 
import { User } from '../model/User';
import { Transaction } from '../model/Transaction';
import { GroupTransaction } from '../model/GroupTransaction';
import { TransactionServices } from '../module/TransactionServices';

const router = Router();    

interface SplitMember {
    userID: number;
    amount: number;
}
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
            isClosed: false
        });

        await GroupMember.create({
            space_id: group.space_id,
            user_id: userId,
            role: 'Admin',
        });

        for (const user of userInviteList) {
            const userObj = await User.findOne({ where: { user_id: user } });

            if (userObj){
                userList.push({name: userObj.username, profile: userObj.profile_image_base64});
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

                const user = await User.findOne({ where: { user_id: member.user_id }, attributes: ['username', 'profile_image_base64'] });
                return { username: user?.username, profile: user?.profile_image_base64, role: member.role };

            }))
            if (!groupObj) {
                return null
            }
            return {groupID: groupObj.space_id , groupName: groupObj.name, groupDescription: groupObj.description, groupMember: groupMembers, groupStatus: groupObj.isClosed? "Closed":"Active"};
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
            split_member: {},
            paid_member: payloadData.userId
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
            const user = await User.findOne({ where: { user_id: groupTransaction.paid_member } });
            return {groupTransactionID: groupTransaction.group_transaction_id, description: groupTransaction.description ,transaction: transaction?.dataValues, groupSplit: groupTransaction.split_member, paidMember:{username: user?.username, profile: user?.profile_image_base64}};
        }))
        

        return res.status(200).json(transactionList)
    }catch(error){
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.post('/transaction/split', KeyPair.requireAuth() , async (req, res, next): Promise<any>=> {
    try{
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { groupTransactionID, splitMember } = req.body;
        if (!groupTransactionID || !splitMember){
            return res.status(400).json({ message: 'Invalid input' });
        }

        const groupTransaction = await GroupTransaction.findOne({ where: { group_transaction_id: groupTransactionID } });
        if (!groupTransaction){
            return res.status(400).json({ message: 'Group transaction not found' });
        }

        const transaction = await Transaction.findOne({where: {transaction_id: groupTransaction.transaction_id}})
        if (!transaction){
            return res.status(400).json({ message: 'Transaction not found' });
        }

        const groupMemberObj = await GroupMember.findOne({ where: { space_id: groupTransaction.space_id, user_id: payloadData.userId } }); 
        if (!groupMemberObj || groupMemberObj.role !== 'Admin'){
            return res.status(400).json({ message: 'Invalid command' });
        }

        const groupMemberList = await GroupMember.findAll({ where: { space_id: groupTransaction.space_id } });
        const groupMemberUserIDs = groupMemberList.map((member) => member.user_id); 

        if (!Array.isArray(splitMember)) {
            return res.status(400).json("Data must be an array.");
        }
        
        for (const eachSplit of splitMember) {
            if (typeof eachSplit.userID !== 'number' || typeof eachSplit.amount !== 'number') {
                return res.status(400).json({message: "Each item must have userID and amount as numbers."});
            }
            if (!groupMemberUserIDs.includes(eachSplit.userID)){
                return res.status(400).json({message: `User with ID ${eachSplit.userID} not found.`});
            }
        }
        const totalAmount = splitMember.reduce((sum, eachSplit) => sum + eachSplit.amount, 0);
        const transactionAmount = parseFloat(transaction.amount as unknown as string)

        if (totalAmount != transactionAmount) {
            return res.status(400).json({
                message: `Sum of amounts does not match the expected sum. Expected: ${transactionAmount}, Found: ${totalAmount}`
            });
        }
        
        await groupTransaction.update({split_member: splitMember});
        return res.status(200).json({
            groupTransaction: groupTransaction.group_transaction_id, description: groupTransaction.description, splitMember: splitMember, status: "success"
        })
    }catch(error){
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }

})

router.post('/confirm', KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const { groupSpaceID } = req.body;
        if (!groupSpaceID) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const groupSpace = await GroupSpace.findOne({ where: { space_id: groupSpaceID } });
        if (!groupSpace) {
            return res.status(400).json({ message: 'Group not found' });
        }

        const groupMemberObj = await GroupMember.findOne({ where: { space_id: groupSpace.space_id, user_id: payloadData.userId } });
        if (!groupMemberObj || groupMemberObj.role !== 'Admin') {
            return res.status(400).json({ message: 'Invalid command' });
        }

        const groupTransactions = await GroupTransaction.findAll({ where: { space_id: groupSpace.space_id } });
        const allMember = await GroupMember.findAll({ where: { space_id: groupSpace.space_id } });

        for (const groupTransaction of groupTransactions) {
            const currentTransaction = await Transaction.findOne({ where: { transaction_id: groupTransaction.transaction_id } });
            if (!currentTransaction) {
                throw new Error("No Transaction");
            }

            if (!groupTransaction.split_member || Object.keys(groupTransaction.split_member).length === 0) {
                console.log("yay");
                let countMember = 0;
                //auto split with all member
                const memberIDList = allMember.map((member) => {
                    countMember += 1;
                    return member.user_id;
                });

                const eachMemberPrice = currentTransaction.amount / countMember;

                // First, find the paid user once outside the loop
                const paidUserObj = await User.findByPk(groupTransaction.paid_member);
                if (!paidUserObj) {
                    throw new Error(`Paid member with ID ${groupTransaction.paid_member} not found`);
                }

                // Create the expense transaction for the paid member
                await TransactionServices.createTransactionWithNotification(paidUserObj.user_id,{
                    wallet_id: paidUserObj.default_wallet,
                    category_id: paidUserObj.default_category ? paidUserObj.default_category : undefined,
                    amount: currentTransaction.amount,
                    date: currentTransaction.date,
                    type: 'Expense',
                    note: `Paid in advance for group transaction: ${groupTransaction.description}`
                });

                // Loop through each member to create their transactions
                for (const memberID of memberIDList) {
                    // Skip the paid member since we already created their expense transaction
                    if (memberID == groupTransaction.paid_member) {
                        continue;
                    }

                    const userObj = await User.findByPk(memberID);
                    if (!userObj) {
                        console.warn(`Member with ID ${memberID} not found, skipping`);
                        continue;
                    }

                    // Create expense transaction for the current member
                    await TransactionServices.createTransactionWithNotification(userObj.user_id,{
                        wallet_id: userObj.default_wallet,
                        category_id: userObj.default_category ? userObj.default_category : undefined,
                        amount: eachMemberPrice,
                        date: currentTransaction.date,
                        type: 'Expense',
                        note: `Split from Group: ${groupTransaction.description}`
                    });

                    // Create income transaction for the paid member
                    await Transaction.create({
                        wallet_id: paidUserObj.default_wallet,
                        category_id: paidUserObj.default_category,
                        amount: eachMemberPrice,
                        date: currentTransaction.date,
                        type: 'Income',
                        note: `Received split from ${userObj.username} for group transaction: ${groupTransaction.description}`,
                        is_paid: false
                    });
                }

                // Delete the original transactions after creating the splits
                await groupTransaction.destroy();
                await currentTransaction.destroy();
                
            } else {
                const splitSheets = groupTransaction.split_member;

                // First, find the paid member
                const paidMemberID = groupTransaction.paid_member;
                const paidUserObj = await User.findByPk(paidMemberID);
                if (!paidUserObj) {
                    throw new Error(`Paid member with ID ${paidMemberID} not found`);
                }
                
                // Process the split member transactions
                for (const splitSheet of splitSheets as Array<SplitMember>) {
                    const userObj = await User.findByPk(splitSheet.userID);
                    
                    if (!userObj) {
                        console.warn(`User with ID ${splitSheet.userID} not found, skipping`);
                        continue;
                    }
                
                    if (userObj.user_id == paidMemberID) {
                        // This is the paid member - create expense for full amount
                        await TransactionServices.createTransactionWithNotification(userObj.user_id, {
                            wallet_id: userObj.default_wallet,
                            category_id: userObj.default_category ? userObj.default_category : undefined,
                            amount: currentTransaction.amount,
                            date: currentTransaction.date,
                            type: 'Expense',
                            note: `Paid in advance for group transaction: ${groupTransaction.description}`
                        });
                    } else {
                        // This is another member
                        // 1. Create expense transaction for this member with notification
                        await TransactionServices.createTransactionWithNotification(userObj.user_id, {
                            wallet_id: userObj.default_wallet,
                            category_id: userObj.default_category ? userObj.default_category : undefined,
                            amount: splitSheet.amount,
                            date: currentTransaction.date,
                            type: 'Expense',
                            note: `Split from group: ${groupTransaction.description}`
                        });
                        
                        // 2. Create income transaction for the paid member
                        await Transaction.create({
                            wallet_id: paidUserObj.default_wallet, // Important: This goes to paid member's wallet
                            category_id: paidUserObj.default_category,
                            amount: splitSheet.amount,
                            date: currentTransaction.date,
                            type: 'Income',
                            note: `Received split from ${userObj.username} for: ${groupTransaction.description}`,
                            is_paid: false
                        });
                    }
                }
                
                // Delete the original transactions after creating the splits
                await groupTransaction.destroy();
                await currentTransaction.destroy();
            }
        }

        groupSpace.isClosed = true;
        await groupSpace.save();
        res.status(200).json({ status: "confirm success", groupSpace: groupSpace});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;