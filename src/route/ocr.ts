import { Router, Request, Response, RequestHandler } from "express";
import Tesseract from "tesseract.js";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import path from "path";
import KeyPair from "../module/KeyPair";

const router = Router();


router.post("/receipt",  async (req, res, next): Promise<void> => {
    try {
      
      // Read image file and convert to base64
      const base64String = req.body.image;
      const data = { base64_string: base64String, return_image: false, return_ocr: false}
      
      let returnRaw: any
      try {
        // Create a FormData object
        const formData = new FormData();
        formData.append('base64_string', base64String);
        formData.append('return_image', 'false');
        formData.append('return_ocr', 'false');
        
        const response = await fetch("https://api.iapp.co.th/ocr/v3/receipt/base64", {
          method: 'POST',
          headers: {
            // No need to set Content-Type with FormData as it's set automatically
            'apikey': "demo"
          },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // You can only read the response body once
        returnRaw = await response.json();
        console.log(returnRaw.processed.grandTotal);
        
      } catch (error) {
        throw error;
      }
      
      console.log(returnRaw)
      if (!returnRaw) {
        res.status(400).json({ message: "Error processing OCR" });
      }
      
      res.json({ amount: returnRaw.processed.grandTotal });
    } catch (error) {
      console.error("Error processing OCR:", error);
      next(error);
    }
})

export default router;