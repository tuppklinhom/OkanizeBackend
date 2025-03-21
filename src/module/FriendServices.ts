import { Op } from 'sequelize';
import { BudgetNotification } from '../model/BudgetNotification';
import { Transaction } from '../model/Transaction';
import { User } from '../model/User';
import { Wallet } from '../model/Wallet';
import { UserBudgetLimit } from '../model/UserBudgetLimit';
import { Category } from '../model/Category';
import { FriendList } from '../model/FriendList';

export class FriendServices {
    /**
     * Creates a transaction and processes a notification.
     * @param userId - The ID of the user creating the transaction.
     * @param transactionData - The data for the transaction.
     */
    static async sendFriendRequest(senderUserId: number, receiverUserId: number): Promise<any> {
        try {
          // Find the sender user
          const sender = await User.findOne({ where: { user_id: senderUserId } });
          if (!sender) {
            throw new Error('Sender user not found');
          }
    
          // Find the receiver user by username
          const receiver = await User.findOne({ where: { user_id: receiverUserId} });
          if (!receiver) {
            throw new Error('Receiver user not found');
          }
    
          // Check if friend request already exists or users are already friends
          const existingFriendship = await FriendList.findOne({
            where: {
              user_id: senderUserId,
              friend_user_id: receiver.user_id
            }
          });
    
          if (existingFriendship) {
            throw new Error('Friend request already sent or users are already friends');
          }
    
          // TODO: Create a pending friend request record in a new table
          // For now, we'll use the BudgetNotification table to send a notification
    
          // Create a notification for the receiver
          const notification = await BudgetNotification.create({
            user_id: receiver.user_id,
            category_id: 0, // Using 0 as a placeholder for non-category notifications
            type: 'Others',
            date: new Date(),
            message: `${sender.username} sent you a friend request`,
            is_read: false
          });
    
          // TODO: Send a Line notification to the receiver
          await this.sendLineNotification(receiver.line_id, sender, {
            // Notification details here
            type: 'friend_request',
            sender: sender.username,
            sender_id: sender.user_id
          });
    
          return {
            status: 'success',
            message: 'Friend request sent',
            notification: notification
          };
        } catch (error) {
          console.error('Error sending friend request:', error);
          throw error;
        }
      }
    
      /**
       * Accepts a friend request from one user to another
       * @param receiverUserId - The ID of the user accepting the request
       * @param senderUserId - The ID of the user who sent the request
       */
      static async acceptFriendRequest(receiverUserId: number, senderUserId: number): Promise<any> {
        try {
          // Find both users
          const receiver = await User.findOne({ where: { user_id: receiverUserId } });
          const sender = await User.findOne({ where: { user_id: senderUserId } });
    
          if (!receiver || !sender) {
            throw new Error('One or both users not found');
          }
    
          // TODO: Verify that a friend request exists in the pending state
          // For now, we'll assume the request exists
          const existingFriendship = await FriendList.findOne({
            where: {
              user_id: senderUserId,
              friend_user_id: receiver.user_id
            }
          });
    
          if (existingFriendship) {
            throw new Error('Friend request already sent or users are already friends');
          }
    
          // Create bidirectional friendship records
          await FriendList.create({
            user_id: receiverUserId,
            friend_user_id: senderUserId
          });
    
          await FriendList.create({
            user_id: senderUserId,
            friend_user_id: receiverUserId
          });
    
          // Create a notification for the sender that the request was accepted
          const notification = await BudgetNotification.create({
            user_id: senderUserId,
            category_id: 0,
            type: 'Others',
            date: new Date(),
            message: `${receiver.username} accepted your friend request`,
            is_read: false
          });
    
          // TODO: Send a Line notification to the sender
          await this.sendLineNotification(sender.line_id, receiver,{
            // Notification details here
            type: 'friend_request_accepted',
            receiver: receiver.username,
            receiver_id: receiver.user_id
          });
    
          return {
            status: 'success',
            message: 'Friend request accepted',
            notification: notification
          };
        } catch (error) {
          console.error('Error accepting friend request:', error);
          throw error;
        }
      }

      static async declineFriendRequest(receiverUserId: number, senderUserId: number): Promise<any> {
        try {
          // Find both users
          const receiver = await User.findOne({ where: { user_id: receiverUserId } });
          const sender = await User.findOne({ where: { user_id: senderUserId } });
    
          if (!receiver || !sender) {
            throw new Error('One or both users not found');
          }
    
          // TODO: Verify that a friend request exists in the pending state
          // For now, we'll assume the request exists
    
    
          // Create a notification for the sender that the request was accepted
          const notification = await BudgetNotification.create({
            user_id: senderUserId,
            category_id: 0,
            type: 'Others',
            date: new Date(),
            message: `${receiver.username} declined your friend request`,
            is_read: false
          });
    
          // TODO: Send a Line notification to the sender
          await this.sendLineNotification(sender.line_id, receiver,{
            // Notification details here
            type: 'friend_request_declined',
            receiver: receiver.username,
            receiver_id: receiver.user_id
          });
    
          return {
            status: 'success',
            message: 'Friend request declined',
            notification: notification
          };
        } catch (error) {
          console.error('Error accepting friend request:', error);
          throw error;
        }
      }
    

      private static async sendLineNotification(receiver_line_id: string, sender: User, payload: any): Promise<void> {
        // Get appropriate message content based on notification type
        const messageContent = this.buildLineMessageContent(payload, sender);
    
        const messagePayload = {
          to: receiver_line_id,
          messages: [
            messageContent
          ]
        };
    
        try {
          const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN || ""}`
            },
            body: JSON.stringify(messagePayload),
          });
    
          const data = await response.json();
          console.log('Line Notification Response:', data);
        } catch (error) {
          console.error('Error sending Line notification:', error);
          throw error;
        }
      }


      public static async buildLineMessageContent(payload: any, sender: User): Promise<any> {
        // Different message formats for different notification types
        switch (payload.type) {
          case 'friend_request':
            return {
              type: "flex",
              altText: "Friend Request",
              contents: {
                "type": "bubble",
                "size": "mega",
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "box",
                      "layout": "horizontal",
                      "contents": [
                        {
                          "type": "box",
                          "layout": "vertical",
                          "contents": [
                            {
                              "type": "image",
                              "url": `${sender.profile_image_base64}`,
                              "aspectMode": "cover",
                              "size": "full"
                            }
                          ],
                          "cornerRadius": "100px",
                          "width": "72px",
                          "height": "72px"
                        },
                        {
                          "type": "box",
                          "layout": "vertical",
                          "contents": [
                            {
                              "type": "text",
                              "contents": [
                                {
                                  "type": "span",
                                  "text": `${payload.sender}`,
                                  "weight": "bold",
                                  "color": "#000000"
                                },
                                {
                                  "type": "span",
                                  "text": "     "
                                },
                                {
                                  "type": "span",
                                  "text": "Sending you a friend request"
                                }
                              ],
                              "size": "sm",
                              "wrap": true
                            },
                            {
                              "type": "box",
                              "layout": "horizontal",
                              "contents": [
                                {
                                  "type": "box",
                                  "layout": "baseline",
                                  "contents": [
                                    {
                                      "type": "text",
                                      "text": "Accept",
                                      "size": "sm",
                                      "color": "#FFFFFF",
                                      "margin": "sm",
                                      "align": "center"
                                    }
                                  ],
                                  "spacing": "none",
                                  "margin": "none",
                                  "backgroundColor": "#0bb926",
                                  "cornerRadius": "md",
                                  "borderWidth": "none",
                                  "paddingEnd": "none",
                                  "paddingStart": "none",
                                  "action": {
                                        "type": "postback",
                                        "label": "Accept",
                                        "data": `action=accept&sender_id=${payload.sender_id}`,
                                        "displayText": "I'll accept your friend request!"
                                    }
                                },
                                {
                                  "type": "box",
                                  "layout": "baseline",
                                  "contents": [
                                    {
                                      "type": "text",
                                      "text": "Decline",
                                      "size": "sm",
                                      "color": "#FFFFFF",
                                      "margin": "sm",
                                      "align": "center"
                                    }
                                  ],
                                  "spacing": "none",
                                  "margin": "md",
                                  "backgroundColor": "#bb3447",
                                  "cornerRadius": "md",
                                  "action": {
                                        "type": "postback",
                                        "label": "Accept",
                                        "data": `action=decline&sender_id=${payload.sender_id}`,
                                        "displayText": "I'll accept your friend request!"
                                    }
                                }
                              ],
                              "spacing": "none",
                              "margin": "md",
                              "backgroundColor": "#FFFFFF"
                            }
                          ]
                        }
                      ],
                      "spacing": "xl",
                      "paddingAll": "20px"
                    }
                  ],
                  "paddingAll": "0px"
                }
              }
            };
            
          case 'friend_request_accepted':
            const receiver = await User.findOne({ where: { user_id: payload.receiver_id } });
            return {
              type: "flex",
              altText: "Friend Request Accepted",
              contents: {
                "type": "bubble",
                "size": "mega",
                "body": {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "box",
                      "layout": "horizontal",
                      "contents": [
                        {
                          "type": "box",
                          "layout": "vertical",
                          "contents": [
                            {
                              "type": "image",
                              "url": `${receiver?.profile_image_base64}`,
                              "aspectMode": "cover",
                              "size": "full"
                            }
                          ],
                          "cornerRadius": "100px",
                          "width": "72px",
                          "height": "72px"
                        },
                        {
                          "type": "box",
                          "layout": "vertical",
                          "contents": [
                            {
                              "type": "text",
                              "contents": [
                                {
                                  "type": "span",
                                  "text": `${payload.receiver}`,
                                  "weight": "bold",
                                  "color": "#000000"
                                },
                                {
                                  "type": "span",
                                  "text": "     "
                                },
                                {
                                  "type": "span",
                                  "text": "Accepted your friend request"
                                }
                              ],
                              "size": "sm",
                              "wrap": true
                            }
                          ]
                        }
                      ],
                      "spacing": "xl",
                      "paddingAll": "20px"
                    }
                  ],
                  "paddingAll": "0px"
                }
              }
            };
            
          default:
            // Default message format
            return {
              type: "text",
              text: "You have a new notification"
            };
        }
      }

}