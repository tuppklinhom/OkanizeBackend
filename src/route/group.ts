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


function calculateNetAmounts(paymentTracker: Map<number, { creditor: number; amount: number; name: string; transactionIds: number; }[]>) {
    // Create a net amount tracker with your specified structure
    const netTracker = new Map<string, {
      debtorId: number;
      creditorId: number;
      amount: number; // net amount (positive means debtor pays creditor)
      transactions: { 
        transactionId: number; 
        amount: number; // positive if debtor pays creditor, negative if creditor pays debtor
        name: string;
      }[];
    }>();
    
    // Process all debt records
    paymentTracker.forEach((transactions, debtorId) => {
      transactions.forEach(transaction => {
        const creditorId = transaction.creditor;
        const amount = transaction.amount;
        const name = transaction.name;
        const transactionId = transaction.transactionIds;
        
        // Determine the key - always store with smaller ID first for consistency
        const key = `${debtorId}-${creditorId}`;
        
        // Get or create the record
        if (!netTracker.has(key)) {
          netTracker.set(key, {
            debtorId,
            creditorId,
            amount: 0,
            transactions: []
          });
        }
        
        const record = netTracker.get(key)!;
        
        // Add the transaction (positive amount since debtor pays creditor)
        record.transactions.push({
          transactionId,
          amount,  // Positive because debtor needs to pay creditor
          name
        });
        
        // Update the net amount
        record.amount += amount;
      });
    });
    
    // Process reverse debts - check if there are transactions in the opposite direction
    const processedKeys = new Set<string>();
    
    netTracker.forEach((record, key) => {
      if (processedKeys.has(key)) return;
      
      const [debtorIdStr, creditorIdStr] = key.split('-');
      const debtorId = parseInt(debtorIdStr);
      const creditorId = parseInt(creditorIdStr);
      
      // Check for the reverse relationship
      const reverseKey = `${creditorId}-${debtorId}`;
      
      if (netTracker.has(reverseKey)) {
        const reverseRecord = netTracker.get(reverseKey)!;
        
        // Compare amounts to determine net direction
        if (record.amount >= reverseRecord.amount) {
          // Original debtor still owes money
          record.amount -= reverseRecord.amount;
          
          // Add reverse transactions with negative amounts
          reverseRecord.transactions.forEach(t => {
            record.transactions.push({
              transactionId: t.transactionId,
              amount: -t.amount, // Negative because this is creditor paying debtor
              name: t.name
            });
          });
          
          // Remove the reverse record since it's consolidated
          netTracker.delete(reverseKey);
        } else {
          // Original creditor now owes money
          reverseRecord.amount -= record.amount;
          
          // Add original transactions with negative amounts
          record.transactions.forEach(t => {
            reverseRecord.transactions.push({
              transactionId: t.transactionId,
              amount: -t.amount, // Negative because we're switching debtor/creditor
              name: t.name
            });
          });
          
          // Remove the original record since it's consolidated
          netTracker.delete(key);
        }
        
        processedKeys.add(key);
        processedKeys.add(reverseKey);
      }
    });
    
    // Filter out any entries with zero net amount
    
    return netTracker;
}

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
        
        
        const paymentTracker = new Map<number, {
            creditor: number; // Creditor ID
            amount: number; // Amount owed
            name: string; // Name of transaction
            transactionIds: number; // Transaction IDs
        }[]>(); 

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


            if (!groupTransaction.split_member || Object.keys(groupTransaction.split_member).length === 0) {
                // Auto-split with all members equally
                const memberCount = allMember.length;
                const eachMemberAmount = transactionAmount / memberCount;

                // Track what each member owes (their fair share)
                for (const member of allMember) {

                    
                    const userObj = await User.findByPk(member.user_id);
                    if (!userObj) continue;

                    // Create expense transaction for the current member
                    const expenseTransaction = await TransactionServices.createTransactionWithNotification(userObj.user_id, {
                        wallet_id: userObj.default_wallet,
                        category_id: userObj.default_category ? userObj.default_category : undefined,
                        amount: eachMemberAmount,
                        date: currentTransaction.date,
                        type: 'Expense',
                        note: `Split from Group: ${groupTransaction.description}`,
                        is_paid: true
                    });

                    const paymentRecord = paymentTracker.get(member.user_id) || []; // Get existing array or create empty one if it doesn't exist
                    paymentRecord.push({ 
                        creditor: paidMemberID, 
                        amount: eachMemberAmount, 
                        name: `Split from Group: ${groupTransaction.description}`, 
                        transactionIds: expenseTransaction.transaction_id 
                    });
                    paymentTracker.set(member.user_id, paymentRecord);
                }
            } else {
                // Handle custom split
                const splitSheets = groupTransaction.split_member as Array<SplitMember>;
                
                // Track what each member owes based on custom split
                for (const splitSheet of splitSheets) {

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
                        is_paid: true
                    });

                    const paymentRecord = paymentTracker.get(userObj.user_id) || []; 
                    paymentRecord.push({ 
                        creditor: paidMemberID, 
                        amount: splitSheet.amount, 
                        name: `Split from Group: ${groupTransaction.description}`, 
                        transactionIds: expenseTransaction.transaction_id 
                    });
                    paymentTracker.set(userObj.user_id, paymentRecord);
                }
            }
            
            // Delete the original transaction after processing
            await groupTransaction.destroy();
            await currentTransaction.destroy();
        }


        // calculate the summary of each member
        calculateNetAmounts(paymentTracker).forEach(async (record) => {
            const isPaid = (parseFloat(record.amount as unknown as string) == 0) ? true : false;
            await SummaryGroupTransaction.create({
                space_id: groupSpace.space_id,
                user_id: record.debtorId,
                target_id: record.creditorId,
                amount: record.amount,
                transaction_ids: record.transactions,
                description: `รายจ่ายกลุ่ม ${groupSpace.name}`,
                is_paid: isPaid
            });
        })
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