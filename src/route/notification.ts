import { Router, Request, Response, RequestHandler } from "express";
const router = Router();


router.post("/search",  async (req, res, next): Promise<void> => {
    try {
        
      
        res.json();
    } catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
    }
})

router.post("/request",  async (req, res, next): Promise<void> => {
    try {
        
        
        res.json();
    } catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
    }
})

router.post("/accept",  async (req, res, next): Promise<void> => {
    try {
        
        
        res.json();
    } catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
    }
})
export default router;