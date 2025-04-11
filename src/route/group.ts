import { Router } from 'express';
import KeyPair from '../module/KeyPair';
import { GroupMember } from '../model/GroupMember';
import { GroupSpace } from '../model/GroupSpace';
import jwt, { JwtPayload } from 'jsonwebtoken'; 
import { User } from '../model/User';
import { Transaction } from '../model/Transaction';
import { GroupTransaction } from '../model/GroupTransaction';
import { TransactionServices } from '../module/TransactionServices';
import { SummaryGroupTransaction } from '../model/SummaryGroupTransaction';
import { Op } from 'sequelize';

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
        
        // Track balances: who paid and who owes
        const balances = new Map<number, number>(); // userId -> balance (positive: is owed money, negative: owes money)
        const expenseTransactionMap = new Map<number, number[]>(); // userId -> list of expense transaction IDs
        const incomeTransactionMap = new Map<number, number[]>(); // userId -> list of income transaction IDs
        
        // Initialize balances and transaction maps for all members
        for (const member of allMember) {
            balances.set(member.user_id, 0);
            expenseTransactionMap.set(member.user_id, []);
            incomeTransactionMap.set(member.user_id, []);
        }

        for (const groupTransaction of groupTransactions) {
            const currentTransaction = await Transaction.findOne({ where: { transaction_id: groupTransaction.transaction_id } });
            if (!currentTransaction) {
                throw new Error("No Transaction");
            }

            const paidMemberID = groupTransaction.paid_member;
            const transactionAmount = parseFloat(currentTransaction.amount as unknown as string);
            const paidUserObj = await User.findByPk(paidMemberID);
            
            if (!paidUserObj) {
                throw new Error(`Paid member with ID ${paidMemberID} not found`);
            }

            // Update balance for payer (they paid the full amount)
            balances.set(paidMemberID, (balances.get(paidMemberID) || 0) + transactionAmount);

            if (!groupTransaction.split_member || Object.keys(groupTransaction.split_member).length === 0) {
                // Auto-split with all members equally
                const memberCount = allMember.length;
                const eachMemberAmount = transactionAmount / memberCount;

                // Create expense transaction for the paid member
                await TransactionServices.createTransactionWithNotification(paidUserObj.user_id, {
                    wallet_id: paidUserObj.default_wallet,
                    category_id: paidUserObj.default_category ? paidUserObj.default_category : undefined,
                    amount: transactionAmount,
                    date: currentTransaction.date,
                    type: 'Expense',
                    note: `Paid in advance for group transaction: ${groupTransaction.description}`
                });

                // For each member, adjust their balance (they owe their share)
                for (const member of allMember) {
                    if (member.user_id === paidMemberID) continue; // Skip the payer
                    
                    const userObj = await User.findByPk(member.user_id);
                    if (!userObj) continue;

                    // Update balance for this member (they owe their share)
                    balances.set(member.user_id, (balances.get(member.user_id) || 0) - eachMemberAmount);

                    // Create expense transaction for the current member
                    const expenseTransaction = await TransactionServices.createTransactionWithNotification(userObj.user_id, {
                        wallet_id: userObj.default_wallet,
                        category_id: userObj.default_category ? userObj.default_category : undefined,
                        amount: eachMemberAmount,
                        date: currentTransaction.date,
                        type: 'Expense',
                        note: `Split from Group: ${groupTransaction.description}`
                    });

                    // Create income transaction for the paid member
                    const incomeTransaction = await Transaction.create({
                        wallet_id: paidUserObj.default_wallet,
                        category_id: paidUserObj.default_category,
                        amount: eachMemberAmount,
                        date: currentTransaction.date,
                        type: 'Income',
                        note: `Received split from ${userObj.username} for group transaction: ${groupTransaction.description}`,
                        is_paid: false
                    });
                    
                    // Track the created transaction IDs
                    const memberExpenseTransactions = expenseTransactionMap.get(member.user_id) || [];
                    memberExpenseTransactions.push(expenseTransaction.transaction_id);
                    expenseTransactionMap.set(member.user_id, memberExpenseTransactions);
                    
                    const paidMemberIncomeTransactions = incomeTransactionMap.get(paidMemberID) || [];
                    paidMemberIncomeTransactions.push(incomeTransaction.transaction_id);
                    incomeTransactionMap.set(paidMemberID, paidMemberIncomeTransactions);
                }
            } else {
                // Handle custom split
                const splitSheets = groupTransaction.split_member as Array<SplitMember>;
                
                // Create expense transaction for the paid member
                await TransactionServices.createTransactionWithNotification(paidUserObj.user_id, {
                    wallet_id: paidUserObj.default_wallet,
                    category_id: paidUserObj.default_category ? paidUserObj.default_category : undefined,
                    amount: transactionAmount,
                    date: currentTransaction.date,
                    type: 'Expense',
                    note: `Paid in advance for group transaction: ${groupTransaction.description}`
                });
                
                // Process each member's split amount
                for (const splitSheet of splitSheets) {
                    const userObj = await User.findByPk(splitSheet.userID);
                    if (!userObj) continue;

                    // Skip the payer (they don't owe themselves)
                    if (userObj.user_id === paidMemberID) continue;

                    // Update balance for this member (they owe their share)
                    balances.set(splitSheet.userID, (balances.get(splitSheet.userID) || 0) - splitSheet.amount);

                    // Create expense transaction for the current member
                    const expenseTransaction = await TransactionServices.createTransactionWithNotification(userObj.user_id, {
                        wallet_id: userObj.default_wallet,
                        category_id: userObj.default_category ? userObj.default_category : undefined,
                        amount: splitSheet.amount,
                        date: currentTransaction.date,
                        type: 'Expense',
                        note: `Split from group: ${groupTransaction.description}`,
                        is_paid: false
                    });
                    
                    // Create income transaction for the paid member
                    const incomeTransaction = await Transaction.create({
                        wallet_id: paidUserObj.default_wallet,
                        category_id: paidUserObj.default_category,
                        amount: splitSheet.amount,
                        date: currentTransaction.date,
                        type: 'Income',
                        note: `Received split from ${userObj.username} for: ${groupTransaction.description}`,
                        is_paid: false
                    });
                    
                    // Track the created transaction IDs
                    const memberExpenseTransactions = expenseTransactionMap.get(splitSheet.userID) || [];
                    memberExpenseTransactions.push(expenseTransaction.transaction_id);
                    expenseTransactionMap.set(splitSheet.userID, memberExpenseTransactions);
                    
                    const paidMemberIncomeTransactions = incomeTransactionMap.get(paidMemberID) || [];
                    paidMemberIncomeTransactions.push(incomeTransaction.transaction_id);
                    incomeTransactionMap.set(paidMemberID, paidMemberIncomeTransactions)
                }
            }
            
            // Delete the original transaction after processing
            await groupTransaction.destroy();
            await currentTransaction.destroy();
        }
        
        // Create SummaryGroupTransaction records for net balances
        const debtors = Array.from(balances.entries())
            .filter(([_, balance]) => balance < 0)  // People who owe money (negative balance)
            .sort((a, b) => a[1] - b[1]);          // Sort by balance (most negative first)
            
        const creditors = Array.from(balances.entries())
            .filter(([_, balance]) => balance > 0)  // People who are owed money (positive balance)
            .sort((a, b) => b[1] - a[1]);          // Sort by balance (most positive first)

        // Handle cases where balances already equal zero (settled) - NEW CODE
        for (const [userId, balance] of balances.entries()) {
            if (Math.abs(balance) < 0.01) { // Balance is effectively zero
                const transactionIds = [...(expenseTransactionMap.get(userId) || []), 
                                    ...(incomeTransactionMap.get(userId) || [])];
                console.log(transactionIds)
                
                if (transactionIds.length > 0) {
                    // Create a self-transaction that's already marked as paid
                    await SummaryGroupTransaction.create({
                        user_id: userId,
                        space_id: groupSpace.space_id,
                        target_id: userId, // Self-transaction since balance is already settled
                        transaction_ids: {
                            debtor: expenseTransactionMap.get(userId) || [],
                            creditor: incomeTransactionMap.get(userId) || []
                        },
                        description: `Settled balance for group: ${groupSpace.name}`,
                        amount: transactionIds.reduce((sum, id) => sum + (expenseTransactionMap.get(userId)?.includes(id) ? -1 : 1), 0) // Net amount
                    });
                }
            }
        }

        // Optimization: Simplify payments by matching debtors to creditors
        let debtorIndex = 0;
        let creditorIndex = 0;

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const [debtorId, debtorBalance] = debtors[debtorIndex];
            const [creditorId, creditorBalance] = creditors[creditorIndex];
            
            const amountToTransfer = Math.min(Math.abs(debtorBalance), creditorBalance);
            
            if (amountToTransfer > 0) {
                // Get the transaction IDs from our maps
                const debtorTransactionIds = expenseTransactionMap.get(debtorId) || [];
                const creditorTransactionIds = incomeTransactionMap.get(creditorId) || [];
                
                // Create summary record: debtor needs to pay creditor
                await SummaryGroupTransaction.create({
                    user_id: debtorId,             // Person who needs to pay
                    space_id: groupSpace.space_id,
                    target_id: creditorId,         // Person who receives payment
                    transaction_ids: {
                        debtor: debtorTransactionIds,
                        creditor: creditorTransactionIds
                    },
                    description: `Payment for group: ${groupSpace.name}`,
                    amount: amountToTransfer
                });
                
                // Update balances
                debtors[debtorIndex][1] += amountToTransfer;
                creditors[creditorIndex][1] -= amountToTransfer;
                
                // Check if balance settled to zero and mark as paid if necessary
                if (Math.abs(debtors[debtorIndex][1]) < 0.01) {
                    // Optional: Update the transaction to mark it as paid
                    // Could implement this if you have transaction ID from the create operation
                    debtorIndex++;
                }
                
                if (creditors[creditorIndex][1] < 0.01) {
                    creditorIndex++;
                }
            }
        }
        // Mark group as closed
        groupSpace.isClosed = true;
        await groupSpace.save();
        
        res.status(200).json({ 
            status: "confirm success", 
            groupSpace: groupSpace
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;