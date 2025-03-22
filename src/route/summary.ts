import { Router, Request, Response, RequestHandler } from "express";
import KeyPair from "../module/KeyPair";
import jwt from "jsonwebtoken";
import { SummaryService } from "../module/SummaryServices";
const router = Router();

type TimeFormat = 'week' | 'month' | 'year';

router.get("/transaction/:timeFormat", KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const timeFormat = req.params.timeFormat as TimeFormat;

        if (!['week', 'month', 'year'].includes(timeFormat)) {
            return res.status(400).json({ message: 'Invalid time format' });
        }

        const data = await SummaryService.generateDailySummary(payloadData.userId, timeFormat);
      
        res.json(data);
    } catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
    }
})

router.get("/category/:timeFormat", KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const timeFormat = req.params.timeFormat as TimeFormat;

        if (!['week', 'month', 'year'].includes(timeFormat)) {
            return res.status(400).json({ message: 'Invalid time format' });
        }

        const data = await SummaryService.generateCategorySummary(payloadData.userId, timeFormat);
      
        res.json(data);
    } catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
    }
})

router.get("/initiate_summary_message", KeyPair.requireAuth(), async (req, res, next): Promise<any> => {
    try {
        const token = req.headers['access-token'] as string;
        const payloadData = jwt.decode(token);
        if (typeof payloadData === 'string' || !payloadData) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        const data = await SummaryService.sendSummaryMessage(payloadData.userId);
      
        res.json(data);
    }catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
    }    
})

export default router;