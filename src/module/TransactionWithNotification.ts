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

        let category: Category | null = null
        let budget: UserBudgetLimit | null = null
        let currentSpend: number = 0
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
                    category = currentCategory
                    budget = categoryBudget
                    currentSpend = totalAmount + parseFloat(transactionData.amount as unknown as string)
                }else if (totalAmount + parseFloat(transactionData.amount as unknown as string) > categoryBudget.budget_limit * 0.8){
                    type = "Warning"
                    category = currentCategory
                    budget = categoryBudget
                    currentSpend = totalAmount + parseFloat(transactionData.amount as unknown as string)
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
        if (type != null && category != null && budget != null) await this.processNotification(userId, transaction, type, category, budget, currentSpend);

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

        let category: Category | null = null
        let budget: UserBudgetLimit | null = null
        let currentSpend: number = 0

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
                    category = currentCategory
                    budget = categoryBudget
                    currentSpend = totalAmount + parseFloat(transactionData.amount as unknown as string)
                }else if (totalAmount + parseFloat(transactionData.amount as unknown as string) > categoryBudget.budget_limit * 0.8){
                    type = "Warning"
                    category = currentCategory
                    budget = categoryBudget
                    currentSpend = totalAmount + parseFloat(transactionData.amount as unknown as string)
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
        if (type != null && category != null && budget != null) await this.processNotification(userId, currentTransaction, type, category, budget, currentSpend);

        return currentTransaction;
    }

    /**
     * Processes a notification for a transaction.
     * @param userId - The ID of the user to notify.
     * @param transaction - The transaction to notify about.
     */
    static async processNotification(userId: number, transaction: Transaction, type: 'Warning' | 'Exceed' | 'Others', category: Category, budgetLimit: UserBudgetLimit, currentSpend: number): Promise<void> {
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

        let headersMessage1, headersMessage2
        if (type == "Warning"){
            headersMessage1 = "ใกล้เกินงบแล้ว"
            headersMessage2 = "การใช้จ่ายเกิน 80% ของงบที่ตั้งไว้แล้ว"
        }else if (type == "Exceed"){
            headersMessage1 = "เกินงบแล้ว"
            headersMessage2 = "การใช้จ่ายเกินงบที่ตั้งไว้แล้ว"
        }
    


        //send Line through this
        const messagePayload = {
            to: user.line_id,
            messages: [
                {
                    type: "flex",
                    altText: "แจ้งเตือนการใช้จ่าย",
                    contents:{
                        "type": "bubble",
                        "size": "mega",
                        "hero": {
                          "type": "image",
                          "url": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
                          "size": "full",
                          "aspectRatio": "20:13",
                          "aspectMode": "cover",
                          "action": {
                            "type": "uri",
                            "uri": "https://line.me/"
                          }
                        },
                        "body": {
                          "type": "box",
                          "layout": "vertical",
                          "contents": [
                            {
                              "type": "text",
                              "text": `${headersMessage1}`,
                              "weight": "bold",
                              "size": "xxl",
                              "margin": "none",
                              "style": "normal",
                              "decoration": "none",
                              "align": "start",
                              "action": {
                                "type": "message",
                                "label": "action",
                                "text": "hello"
                              }
                            },
                            {
                              "type": "box",
                              "layout": "vertical",
                              "margin": "md",
                              "contents": [
                                {
                                  "type": "text",
                                  "text": `${headersMessage2}`,
                                  "size": "md",
                                  "color": "#999999",
                                  "margin": "none",
                                  "flex": 0,
                                  "align": "start"
                                }
                              ]
                            }
                          ]
                        },
                        "footer": {
                          "type": "box",
                          "layout": "vertical",
                          "margin": "lg",
                          "spacing": "sm",
                          "contents": [
                            {
                              "type": "box",
                              "layout": "vertical",
                              "spacing": "xs",
                              "contents": [
                                {
                                  "type": "text",
                                  "text": "ประเภท",
                                  "color": "#666666",
                                  "size": "sm",
                                  "flex": 1,
                                  "weight": "bold",
                                  "decoration": "none"
                                },
                                {
                                  "type": "text",
                                  "text": `${category.name}`,
                                  "wrap": true,
                                  "color": "#666666",
                                  "size": "sm",
                                  "flex": 5
                                }
                              ],
                              "borderWidth": "none",
                              "margin": "none"
                            },
                            {
                              "type": "box",
                              "layout": "vertical",
                              "spacing": "sm",
                              "contents": [
                                {
                                  "type": "text",
                                  "text": "งบที่ตั้งไว้",
                                  "color": "#666666",
                                  "size": "sm",
                                  "flex": 1,
                                  "margin": "md",
                                  "weight": "bold"
                                },
                                {
                                  "type": "text",
                                  "text": `${budgetLimit.budget_limit} บาท`,
                                  "wrap": true,
                                  "color": "#666666",
                                  "size": "sm",
                                  "flex": 5
                                },
                                {
                                  "type": "box",
                                  "layout": "vertical",
                                  "spacing": "sm",
                                  "contents": [
                                    {
                                      "type": "text",
                                      "text": "การใช้จ่ายปัจจุบัน",
                                      "color": "#666666",
                                      "size": "sm",
                                      "flex": 1,
                                      "margin": "md",
                                      "weight": "bold"
                                    },
                                    {
                                      "type": "text",
                                      "text": `${currentSpend} บาท`,
                                      "wrap": true,
                                      "color": "#666666",
                                      "size": "sm",
                                      "flex": 5
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        },
                        "action": {
                          "type": "message",
                          "label": "action",
                          "text": "hello"
                        },
                        "direction": "ltr"
                      }

                }
                  
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