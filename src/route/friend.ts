import { Router, Request, Response, RequestHandler } from "express";
import KeyPair from "../module/KeyPair";
import { User } from "../model/User";
import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { FriendList } from "../model/FriendList";
import { FriendServices } from "../module/FriendServices";
const router = Router();


router.get("/search", KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const queryName = req.query.username;

        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            res.status(400).json({ message: 'Invalid token' });
            return;
        }

                // Search for users with similar username
        const userList = await User.findAll({
            where: {
                username: {
                    [Op.like]: `%${queryName}%`
                },
                user_id: {
                    [Op.ne]: payloadData.userId // Exclude the current user
                }
            },
            attributes: ['user_id', 'username', 'profile_image_base64']
        })
        
        if (!userList || userList.length === 0) {
            return res.status(400).json({ message: "No user found" });
        }

        const usersWithFriendStatus = await Promise.all(userList.map(async (user) => {
            console.log(payloadData.userId, user.user_id);
            const isFriend = await FriendList.findOne({
                where: {    
                    user_id: payloadData.userId,
                    friend_user_id: user.user_id
                }
            });

            return {
                user_id: user.user_id,
                username: user.username,
                profile_image_base64: user.profile_image_base64,
                is_friend: !!isFriend
            };
        }));

        res.json(usersWithFriendStatus);
    } catch (error) {
        console.error("Error :", error);
        next(error);
    }
})

router.post("/request", KeyPair.requireAuth(),   async (req, res, next): Promise<void> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            res.status(400).json({ message: 'Invalid token' });
            return;
        }

        const { targetUserID } = req.body;
        if (!targetUserID) {
            res.status(400).json({ message: 'Username is required' });
            return;
        }
        

        const result = await FriendServices.sendFriendRequest(payloadData.userId, targetUserID);
        res.json(result);
    } catch (error) {
        console.error("Error sending friend request:", error);
        if (error instanceof Error) {
            res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
})

router.post("/accept",  async (req, res, next): Promise<void> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            res.status(400).json({ message: 'Invalid token' });
            return;
        }

        const { senderUserId } = req.body;
        if (!senderUserId) {
            res.status(400).json({ message: 'Sender user ID is required' });
            return;
        }

        const result = await FriendServices.acceptFriendRequest(payloadData.userId, senderUserId);
        res.json(result);
    } catch (error) {
        console.error("Error accepting friend request:", error);
        if (error instanceof Error) {
            res.status(400).json({ message: error.message });
        } else {
            next(error);
        }
    }
})



/**
 * Get friend list
 */
router.get("/list", KeyPair.requireAuth(), async (req, res, next): Promise<void> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            res.status(400).json({ message: 'Invalid token' });
            return;
        }

        // Get all friends
        const friendList = await FriendList.findAll({
            where: {
                user_id: payloadData.userId
            }
        });

        // Get details for each friend
        const friends = await Promise.all(friendList.map(async (friendship) => {
            const friend = await User.findOne({
                where: { user_id: friendship.friend_user_id },
                attributes: ['user_id', 'username', 'profile_image_base64']
            });
            return friend;
        }));

        res.json(friends.filter(f => f !== null));
    } catch (error) {
        console.error("Error getting friend list:", error);
        next(error);
    }
});

/**
 * Remove a friend
 */
router.post("/remove", KeyPair.requireAuth(), async (req, res, next): Promise<void> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            res.status(400).json({ message: 'Invalid token' });
            return;
        }

        const { friendUserId } = req.body;
        if (!friendUserId) {
            res.status(400).json({ message: 'Friend user ID is required' });
            return;
        }

        // Remove both directions of the friendship
        await FriendList.destroy({
            where: {
                user_id: payloadData.userId,
                friend_user_id: friendUserId
            }
        });

        await FriendList.destroy({
            where: {
                user_id: friendUserId,
                friend_user_id: payloadData.userId
            }
        });

        res.json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error("Error removing friend:", error);
        next(error);
    }
});
export default router;