import { Router } from 'express';
import { FriendServices } from '../module/FriendServices';
import { User } from '../model/User';
// import queryString from 'query-string';
// At the top of your file, declare the type but don't import


// Make sure to call this before using queryString


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
    const { data } = event.postback;
    const userId = event.source.userId;
    
    // Parse the data from the postback
    const params = new URLSearchParams(data);
    const action = params.get('action') || ''; // Provide default empty string
    
    // For the senderId, handle the potential null and parsing
    const senderIdParam = params.get('sender_id');
    const senderId = senderIdParam ? parseInt(senderIdParam) : null;
    
    // Get the user from the Line user ID
    const user = await User.findOne({ where: { line_id: userId } });
    if (!user) {
        console.error('Unknown user for Line ID:', userId);
        return;
    }
    if (!senderId) {
        console.error('Unknown sender ID:', senderId);
        return;
    }

    // Handle different actions
    switch (action) {
      case 'accept':
        await FriendServices.acceptFriendRequest(user.user_id, senderId);
        
        // Send a confirmation message back to the user
        await sendTextMessage(userId, senderId, 'Accepted');
        break;
        
      case 'decline':
        
        // Send a confirmation message back to the user
        await sendTextMessage(userId, senderId,'Declined');
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
async function sendTextMessage(lineUserId: string, senderId: number, text: string): Promise<void> {
    const sender = await User.findOne({ where: { user_id: senderId } });

 
  const messagePayload = {
    to: lineUserId,
    messages: [
        {
            type: "flex",
            altText: `Friend Request ${text}`,
            contents: {
                "type": "bubble",
                "size": "giga",
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
                              "url": `${sender?.profile_image_base64}`,
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
                                  "text": `You ${text} `,
                                  "weight": "regular"
                                },
                                {
                                  "type": "span",
                                  "text": `${sender?.username} `,
                                  "color": "#000000",
                                  "weight": "bold"
                                },
                                {
                                  "type": "span",
                                  "text": "friend request"
                                }
                              ],
                              "size": "sm",
                              "wrap": true
                            }
                          ],
                          "position": "relative",
                          "justifyContent": "center"
                        }
                      ],
                      "spacing": "xl",
                      "paddingAll": "20px"
                    }
                  ],
                  "paddingAll": "0px"
                }
              }
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