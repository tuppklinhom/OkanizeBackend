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
        
        // Track amounts paid and owed by each user
        const paidAmounts = new Map<number, number>(); // userId -> amount paid
        const owedAmounts = new Map<number, number>(); // userId -> amount owed
        
        // Track all transactions related to a user
        const expenseTransactionMap = new Map<number, number[]>(); // userId -> list of expense transaction IDs
        const incomeTransactionMap = new Map<number, number[]>(); // userId -> list of income transaction IDs
        
        // Track transactions in a simple way for readability
        interface SimpleTransaction {
            id: number;
            note: string;
            amount: number;
        }
        
        // Each user will have outgoing (they pay) and incoming (they receive) transactions
        const userTransactions = new Map<number, {
            outgoing: SimpleTransaction[],
            incoming: SimpleTransaction[]
        }>();
        
        // Initialize maps for all members
        for (const member of allMember) {
            paidAmounts.set(member.user_id, 0);
            owedAmounts.set(member.user_id, 0);
            expenseTransactionMap.set(member.user_id, []);
            incomeTransactionMap.set(member.user_id, []);
            userTransactions.set(member.user_id, {
                outgoing: [],
                incoming: []
            });
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

            // Track how much each user has paid upfront
            paidAmounts.set(paidMemberID, (paidAmounts.get(paidMemberID) || 0) + transactionAmount);

            // Create expense transaction for the paid member (keep original behavior)
            const paidMemberExpense = await TransactionServices.createTransactionWithNotification(paidUserObj.user_id, {
                wallet_id: paidUserObj.default_wallet,
                category_id: paidUserObj.default_category ? paidUserObj.default_category : undefined,
                amount: transactionAmount,
                date: currentTransaction.date,
                type: 'Expense',
                note: `Paid in advance for group transaction: ${groupTransaction.description}`
            });
            
            // Track this transaction
            const paidMemberExpenseList = expenseTransactionMap.get(paidMemberID) || [];
            paidMemberExpenseList.push(paidMemberExpense.transaction_id);
            expenseTransactionMap.set(paidMemberID, paidMemberExpenseList);
            
            // Track as a simple outgoing transaction (they paid)
            const userTxns = userTransactions.get(paidMemberID);
            if (userTxns) {
                userTxns.outgoing.push({
                    id: paidMemberExpense.transaction_id,
                    note: `Paid for: ${groupTransaction.description}`,
                    amount: transactionAmount
                });
            }

            if (!groupTransaction.split_member || Object.keys(groupTransaction.split_member).length === 0) {
                // Auto-split with all members equally
                const memberCount = allMember.length;
                const eachMemberAmount = transactionAmount / memberCount;

                // Track what each member owes (their fair share)
                for (const member of allMember) {
                    owedAmounts.set(member.user_id, (owedAmounts.get(member.user_id) || 0) + eachMemberAmount);
                    
                    // Skip the payer for transaction creation (they already paid)
                    if (member.user_id === paidMemberID) continue;
                    
                    const userObj = await User.findByPk(member.user_id);
                    if (!userObj) continue;

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
                    
                    // Track these transactions
                    const memberExpenseList = expenseTransactionMap.get(member.user_id) || [];
                    memberExpenseList.push(expenseTransaction.transaction_id);
                    expenseTransactionMap.set(member.user_id, memberExpenseList);
                    
                    const paidMemberIncomeList = incomeTransactionMap.get(paidMemberID) || [];
                    paidMemberIncomeList.push(incomeTransaction.transaction_id);
                    incomeTransactionMap.set(paidMemberID, paidMemberIncomeList);
                    
                    // Track these as simple transactions
                    // Member has an outgoing transaction (they need to pay)
                    const memberTxns = userTransactions.get(member.user_id);
                    if (memberTxns) {
                        memberTxns.outgoing.push({
                            id: expenseTransaction.transaction_id,
                            note: `Split to : ${groupTransaction.description}`,
                            amount: eachMemberAmount
                        });
                    }
                    
                    // Paid member has an incoming transaction (they should receive)
                    const paidMemberTxns = userTransactions.get(paidMemberID);
                    if (paidMemberTxns) {
                        paidMemberTxns.incoming.push({
                            id: incomeTransaction.transaction_id,
                            note: `Split receive from ${userObj.username}: ${groupTransaction.description}`,
                            amount: eachMemberAmount
                        });
                    }
                }
            } else {
                // Handle custom split
                const splitSheets = groupTransaction.split_member as Array<SplitMember>;
                
                // Track what each member owes based on custom split
                for (const splitSheet of splitSheets) {
                    owedAmounts.set(splitSheet.userID, (owedAmounts.get(splitSheet.userID) || 0) + splitSheet.amount);
                    
                    // Skip the payer (they don't owe themselves)
                    if (splitSheet.userID === paidMemberID) continue;

                    const userObj = await User.findByPk(splitSheet.userID);
                    if (!userObj) continue;

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
                    
                    // Track these transactions
                    const memberExpenseList = expenseTransactionMap.get(splitSheet.userID) || [];
                    memberExpenseList.push(expenseTransaction.transaction_id);
                    expenseTransactionMap.set(splitSheet.userID, memberExpenseList);
                    
                    const paidMemberIncomeList = incomeTransactionMap.get(paidMemberID) || [];
                    paidMemberIncomeList.push(incomeTransaction.transaction_id);
                    incomeTransactionMap.set(paidMemberID, paidMemberIncomeList);
                    
                    // Track these as simple transactions
                    // Member has an outgoing transaction (they need to pay)
                    const memberTxns = userTransactions.get(splitSheet.userID);
                    if (memberTxns) {
                        memberTxns.outgoing.push({
                            id: expenseTransaction.transaction_id,
                            note: `Split from Group ${paidUserObj.username}: ${groupTransaction.description}`,
                            amount: splitSheet.amount
                        });
                    }
                    
                    // Paid member has an incoming transaction (they should receive)
                    const paidMemberTxns = userTransactions.get(paidMemberID);
                    if (paidMemberTxns) {
                        paidMemberTxns.incoming.push({
                            id: incomeTransaction.transaction_id,
                            note: `Split receive from ${userObj.username}: ${groupTransaction.description}`,
                            amount: splitSheet.amount
                        });
                    }
                }
            }
            
            // Delete the original transaction after processing
            await groupTransaction.destroy();
            await currentTransaction.destroy();
        }
        
        // Calculate final balances based on paid vs owed amounts
        const balances = new Map<number, number>();
        
        for (const userId of paidAmounts.keys()) {
            const amountPaid = paidAmounts.get(userId) || 0;
            const amountOwed = owedAmounts.get(userId) || 0;
            const balance = amountPaid - amountOwed; // Positive: overpaid, Negative: underpaid
            balances.set(userId, balance);
            console.log(`User ${userId} paid ${amountPaid}, owed ${amountOwed}, net balance: ${balance}`);
        }
        
        // Identify debtors and creditors
        const debtors = Array.from(balances.entries())
            .filter(([_, balance]) => balance < 0)  // People who owe money (negative balance)
            .sort((a, b) => a[1] - b[1]);          // Sort by balance (most negative first)
            
        const creditors = Array.from(balances.entries())
            .filter(([_, balance]) => balance > 0)  // People who are owed money (positive balance)
            .sort((a, b) => b[1] - a[1]);          // Sort by balance (most positive first)
            
        console.log('Debtors:', debtors);
        console.log('Creditors:', creditors);
        
        // Optimization: Simplify payments by matching debtors to creditors
        let debtorIndex = 0;
        let creditorIndex = 0;
        
        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const [debtorId, debtorBalance] = debtors[debtorIndex];
            const [creditorId, creditorBalance] = creditors[creditorIndex];
            
            // Calculate the exact amount to transfer - this is the key fix
            const amountToTransfer = Math.min(Math.abs(debtorBalance), creditorBalance);
            console.log(`Transfer calculation: ${debtorId} (${debtorBalance}) to ${creditorId} (${creditorBalance}) = ${amountToTransfer}`);
            
            if (amountToTransfer > 0) {
                // Get the debtor's and creditor's details
                const debtorObj = await User.findByPk(debtorId);
                const creditorObj = await User.findByPk(creditorId);
                
                if (!debtorObj || !creditorObj) {
                    throw new Error(`User not found: ${!debtorObj ? debtorId : creditorId}`);
                }
                
                // Get all transactions for both users
                const debtorTxns = userTransactions.get(debtorId);
                const creditorTxns = userTransactions.get(creditorId);
                
                if (!debtorTxns || !creditorTxns) {
                    throw new Error("Transaction data not found");
                }
                
                // Collect only split transactions with record owner
                const debtorContributions = [];
                const creditorContributions = [];
                
                // Process debtor's outgoing transactions (expenses)
                for (const txn of debtorTxns.outgoing) {
                    if (txn.note.includes("Split from Group") || txn.note.includes("Split:")) {
                        debtorContributions.push({
                            note: txn.note,
                            amount: txn.amount,
                            recordOwner: "debtor"
                        });
                    }
                }
                
                // Process debtor's incoming transactions (income)
                for (const txn of debtorTxns.incoming) {
                    if ((txn.note.includes("Received split from") || txn.note.includes("Split receive from")) && (txn.note.includes(creditorObj.username) || txn.note.includes(debtorObj.username))) {
                        debtorContributions.push({
                            note: txn.note,
                            amount: -txn.amount, // Negative for incoming
                            recordOwner: "debtor"
                        });
                    }
                }
                
                // Process creditor's outgoing transactions (expenses)
                for (const txn of creditorTxns.outgoing) {
                    if ((txn.note.includes("Split from Group") || txn.note.includes("Split:")) && (txn.note.includes(creditorObj.username) || txn.note.includes(debtorObj.username))) {
                        creditorContributions.push({
                            note: txn.note,
                            amount: txn.amount,
                            recordOwner: "creditor"
                        });
                    }
                }
                
                // Process creditor's incoming transactions (income)
                for (const txn of creditorTxns.incoming) {
                    if (txn.note.includes("Received split from") || txn.note.includes("Split receive from")) {
                        creditorContributions.push({
                            note: txn.note,
                            amount: -txn.amount, // Negative for incoming
                            recordOwner: "creditor"
                        });
                    }
                }
                
                // Log the exact values being used to create the transaction
                console.log(`Creating SummaryGroupTransaction: debtorId=${debtorId}, creditorId=${creditorId}`);
                console.log(`Paid amounts: debtor=${paidAmounts.get(debtorId) || 0}, creditor=${paidAmounts.get(creditorId) || 0}`);
                console.log(`Owed amounts: debtor=${owedAmounts.get(debtorId) || 0}, creditor=${owedAmounts.get(creditorId) || 0}`);
                console.log(`Final amount to transfer: ${amountToTransfer}`);
                
                // Create summary record with simple transaction list
                await SummaryGroupTransaction.create({
                    user_id: debtorId,             // Person who needs to pay
                    space_id: groupSpace.space_id,
                    target_id: creditorId,         // Person who receives payment
                    transaction_ids: {
                        // Include regular transaction IDs for compatibility
                        debtor: expenseTransactionMap.get(debtorId) || [],
                        creditor: incomeTransactionMap.get(creditorId) || [],
                        // Add paid/owed info for transparency
                        paid: {
                            debtor: paidAmounts.get(debtorId) || 0,
                            creditor: paidAmounts.get(creditorId) || 0
                        },
                        owed: {
                            debtor: owedAmounts.get(debtorId) || 0,
                            creditor: owedAmounts.get(creditorId) || 0
                        },
                        // Only include split transactions with record owner
                        contributions: {
                            debtor: debtorContributions,
                            creditor: creditorContributions
                        }
                    },
                    description: `Payment for group: ${groupSpace.name}`,
                    amount: amountToTransfer
                });
                
                // Update balances - this is critical for correct calculations
                const updatedDebtorBalance = debtors[debtorIndex][1] + amountToTransfer;
                const updatedCreditorBalance = creditors[creditorIndex][1] - amountToTransfer;
                
                debtors[debtorIndex][1] = updatedDebtorBalance;
                creditors[creditorIndex][1] = updatedCreditorBalance;
                
                console.log(`Updated balances: debtor ${debtorId}: ${updatedDebtorBalance}, creditor ${creditorId}: ${updatedCreditorBalance}`);
                
                // Check if balance settled to zero and move to next user if necessary
                // Using a small epsilon for floating point comparison
                if (Math.abs(debtors[debtorIndex][1]) < 0.01) {
                    console.log(`Debtor ${debtorId} balance settled, moving to next debtor`);
                    debtorIndex++;
                }
                
                if (creditors[creditorIndex][1] < 0.01) {
                    console.log(`Creditor ${creditorId} balance settled, moving to next creditor`);
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