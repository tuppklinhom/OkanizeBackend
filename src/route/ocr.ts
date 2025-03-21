import { Router, Request, Response, RequestHandler } from "express";
import Tesseract from "tesseract.js";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import path from "path";
import KeyPair from "../module/KeyPair";

const router = Router();

const upload = multer({ dest: "buffer/" });

const convertThaiNumbers = (text: string): string => {
    const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
    const arabicDigits = "0123456789";
    return text.replace(/[๐-๙]/g, (char) => arabicDigits[thaiDigits.indexOf(char)]);
};

const extractStoreName = (text: string): string | undefined => {
    const lines = text.split("\n").map(line => line.trim()).filter(line => line);
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      if (/[๐-๙0-9]/.test(lines[i])) continue;
      if (lines[i].includes("ร้าน") || lines[i].includes("บริษัท") || i === 0) {
        return lines[i];
      }
    }
    return undefined;
};

const extractAmount = (text: string): string | undefined => {
    const amountRegex = /(?:TOTAL|Total|Sub Total|AMOUNT|Amount|Balance|Due|Grand Total|ยอดสุทธิ|ยอดชำระสุทธิ|สุทธิ|ยอดรวม|รวม|ทั้งหมด|จำนวน|จำนวนเงิน|งิน)\s*[:฿]?\s*([\d,๐-๙]+(?:\.\d{2})?)/i;
    const lines = text.split("\n").map(line => line.trim()).filter(line => line !== "");
  
  // Iterate from bottom (last line) to top (first line)
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(amountRegex);
      if (match && match[1]) {
        return convertThaiNumbers(match[1]); // Return the captured total amount
      }
    } 
    return undefined;
};

const preprocessImage = async (inputPath: string, outputPath: string) => {
    await sharp(inputPath)
      .grayscale()
      .normalize()
      .resize(800)
      .toFormat("png")
      .toFile(outputPath);
};


const performOCR = async (imagePath: string): Promise<{ name?: string; amount?: string }> => {
    const processedPath = path.join(__dirname, "processed.png");
    await preprocessImage(imagePath, processedPath);
  
    const { data: { text } } = await Tesseract.recognize(imagePath, "tha+eng");

    console.log(text);
  
    return {
      name: extractStoreName(text),
      amount: extractAmount(text),
    };
};
  

router.post("/receipt",  async (req, res, next): Promise<void> => {
    try {
      
      // Read image file and convert to base64
      const base64String = req.body.image_base64;
      const data = { base64_string: base64String, return_image: false, return_ocr: false}
      
      let returnRaw
      try {
        const response = await fetch("https://api.iapp.co.th/ocr/v3/receipt/base64", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': "demo"
          },
          body: JSON.stringify(data)
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`)
        }
        
        returnRaw = await response.json()
      } catch (error) {
        throw error
      }
      
      if (!returnRaw || !returnRaw.processed || !returnRaw.processed.grandTotal) {
        res.status(400).json({ message: "Error processing OCR" });
      }
      
      res.json({ amount: returnRaw.processed.grandTotal });
    } catch (error) {
      console.error("Error processing OCR:", error);
      next(error);
    }
})

export default router;