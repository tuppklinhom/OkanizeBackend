import { Router } from 'express';
import { FriendServices } from '../module/FriendServices';
import { User } from '../model/User';
import queryString from 'query-string';

const router = Router();

/**
 * Handle Line webhook callbacks
 */
router.post('/webhook', async (req, res) => {
  try {
    // Line sends webhooks in a specific format
    const events = req.body.events;
    console.log(events)
    
    // Process each event
    for (const event of events) {
      // Handle postback events
      if (event.type === 'postback') {
        await handlePostback(event);
      }
    }
    
    // Always return 200 OK quickly to Line's webhook
    res.status(200).end();
  } catch (error) {
    console.error('Error handling webhook:', error);
    // Still return 200 to Line so they don't retry
    res.status(200).end();
  }
});

/**
 * Handle postback events from Line
 */
async function handlePostback(event: any) {
  try {
    const { data, params } = event.postback;
    const userId = event.source.userId;
    
    // Parse the data from the postback
    const parsedData = queryString.parse(data);
    const action = parsedData.action as string;
    
    // Get the user from the Line user ID
    const user = await User.findOne({ where: { line_id: userId } });
    if (!user) {
      console.error('Unknown user for Line ID:', userId);
      return;
    }
    
    // Handle different actions
    switch (action) {
      case 'accept':
        const senderId = parseInt(parsedData.sender_id as string);
        await FriendServices.acceptFriendRequest(user.user_id, senderId);
        
        // Send a confirmation message back to the user
        await sendTextMessage(userId, 'Friend request accepted!');
        break;
        
      case 'decline':
        const declineSenderId = parseInt(parsedData.sender_id as string);
        
        // Send a confirmation message back to the user
        await sendTextMessage(userId, 'Friend request declined.');
        break;
        

        
      default:
        console.log('Unknown action:', action);
    }
  } catch (error) {
    console.error('Error handling postback:', error);
  }
}

/**
 * Send a simple text message to a user via Line
 */
async function sendTextMessage(lineUserId: string, text: string): Promise<void> {
  const messagePayload = {
    to: lineUserId,
    messages: [
      {
        type: 'text',
        text: text
      }
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
    console.log('Push Message Response:', data);
  } catch (error) {
    console.error('Error sending text message:', error);
  }
}

export default router;