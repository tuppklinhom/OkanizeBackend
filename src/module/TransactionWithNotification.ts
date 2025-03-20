import { Op } from 'sequelize';
import { BudgetNotification } from '../model/BudgetNotification';
import { Transaction } from '../model/Transaction';
import { User } from '../model/User';
import { Wallet } from '../model/Wallet';
import { UserBudgetLimit } from '../model/UserBudgetLimit';
import { Category } from '../model/Category';

export class TransactionWithNotification {
    /**
     * Creates a transaction and processes a notification.
     * @param userId - The ID of the user creating the transaction.
     * @param transactionData - The data for the transaction.
     */
    static async createTransactionWithNotification(userId: number, transactionData: {
        amount: number;
        note: string;
        wallet_id?: number;
        category_id?: number;
        type: 'Expense' | 'Income';
    }): Promise<Transaction> {
        // Find the user
        const user = await User.findOne({ where: { user_id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        let type: 'Exceed' | 'Warning' | 'Others' | null = null;

        // Set default wallet and category if not provided
        const wallet_id = transactionData.wallet_id || user.default_wallet;
        const category_id = transactionData.category_id || user.default_category;
        
        const currentWallet = await Wallet.findOne({ where: { wallet_id } });
        if (!currentWallet) {
            throw new Error('Wallet not found');
        }
        if (category_id){ //if there is category. try to check for notification 
            // Validate wallet
            const currentCategory = await Category.findOne({ where: { category_id } });
            if (!currentCategory) {
                throw new Error('Category not found');
            }
            const categoryBudget = await UserBudgetLimit.findOne({ where: { user_id: userId, category_id: category_id } });
            if (categoryBudget){

                const allWallet = await Wallet.findAll({ where: { user_id: userId } });
                const allWalletID = allWallet.map(wallet => wallet.wallet_id);
    
                const transactionsListForNotification = await Transaction.findAll({ where: { category_id: category_id, wallet_id: {[Op.in]: allWalletID} } });
    
                const totalAmount = transactionsListForNotification.reduce((acc, transaction) => acc + parseFloat(transaction.amount as unknown as string), 0);
                if (totalAmount + parseFloat(transactionData.amount as unknown as string) > categoryBudget.budget_limit) {
                    type = "Exceed"
                }else if (totalAmount + parseFloat(transactionData.amount as unknown as string) > categoryBudget.budget_limit * 0.8){
                    type = "Warning"
                }
            }
        }

        // Create the transaction
        const transaction = await Transaction.create({
            amount: transactionData.amount,
            note: transactionData.note,
            wallet_id: wallet_id,
            category_id: category_id,
            type: transactionData.type,
            date: new Date(),
        });

        // Process the notification
        if (type != null) await this.processNotification(userId, transaction, type);

        return transaction;
    }

    static async updateTransactionWithNotification(userId: number, transaction_id: number, transactionData: {
        amount: number;
        note: string;
        wallet_id?: number;
        category_id?: number;
        type: 'Expense' | 'Income';
        isSorted: boolean;
        isPaid: boolean;
    }): Promise<Transaction> {
        // Find the user
        const user = await User.findOne({ where: { user_id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        let type: 'Exceed' | 'Warning' | 'Others' | null = null;

        // Set default wallet and category if not provided
        const wallet_id = transactionData.wallet_id || user.default_wallet;
        const category_id = transactionData.category_id || user.default_category;

        const currentTransaction = await Transaction.findOne({ where: { transaction_id } });
        if (!currentTransaction) {
            throw new Error('Transaction not found');
        }
        const currentWallet = await Wallet.findOne({ where: { wallet_id } });
        if (!currentWallet) {
            throw new Error('Wallet not found');
        }
        if (category_id){ //if there is category. try to check for notification 
            // Validate wallet
            const currentCategory = await Category.findOne({ where: { category_id } });
            if (!currentCategory) {
                throw new Error('Category not found');
            }
            const categoryBudget = await UserBudgetLimit.findOne({ where: { user_id: userId, category_id: category_id } });
            if (categoryBudget){

                const allWallet = await Wallet.findAll({ where: { user_id: userId } });
                const allWalletID = allWallet.map(wallet => wallet.wallet_id);
    
                const transactionsListForNotification = await Transaction.findAll({ where: { category_id: category_id, wallet_id: {[Op.in]: allWalletID} } });
    
                const totalAmount = transactionsListForNotification.reduce((acc, transaction) => acc + parseFloat(transaction.amount as unknown as string), 0);
                if (totalAmount + parseFloat(transactionData.amount as unknown as string) > categoryBudget.budget_limit) {
                    type = "Exceed"
                }else if (totalAmount + parseFloat(transactionData.amount as unknown as string) > categoryBudget.budget_limit * 0.8){
                    type = "Warning"
                }
            }
        }

        // Create the transaction
        await currentTransaction.update({
            amount: transactionData.amount,
            note: transactionData.note,
            wallet_id: wallet_id,
            category_id: category_id,
            type: transactionData.type,
            is_sorted: transactionData.isSorted,
            is_paid: transactionData.isPaid,
            date: new Date(),
        })
        await currentTransaction.save();

        // Process the notification
        if (type != null) await this.processNotification(userId, currentTransaction, type);

        return currentTransaction;
    }

    /**
     * Processes a notification for a transaction.
     * @param userId - The ID of the user to notify.
     * @param transaction - The transaction to notify about.
     */
    static async processNotification(userId: number, transaction: Transaction, type: 'Warning' | 'Exceed' | 'Others'): Promise<void> {
        const notificationMessage = `A new transaction of ${transaction.amount} has been created.`;

        const user = await User.findOne({ where: { user_id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        // Create a notification in the database
        const noti = await BudgetNotification.create({
            user_id: userId,
            message: notificationMessage,
            category_id: transaction.category_id ? transaction.category_id : 0,
            type: type,
            date: new Date(),
            is_read: false
        });

        //send Line through this
        const messagePayload = {
            to: user.line_id,
            messages: [
              { type: "text", text: `${noti}` }
            ]
        }
        
        try {
            const response = await fetch(`https://api.line.me/v2/bot/message/push`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN || ""}`
              },
              body: JSON.stringify(messagePayload),
            });
    
        
            const data = await response.json();
            console.log("Push Message Response:", data);
        } catch (error) {
            console.error("Error pushing message:", error);
        }
        


        // You can also add logic to send real-time notifications (e.g., via WebSocket or push notifications)
        console.log(`Notification sent to user ${userId}: ${notificationMessage}`);
    }
}