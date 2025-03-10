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
    const amountRegex = /(?:TOTAL|Total|Sub Total|AMOUNT|Amount|Balance|Due|Grand Total|ยอดสุทธิ|ยอดชำระสุทธิ|สุทธิ|ยอดรวม|รวม|ทั้งหมด|จำนวน|จำนวนเงิน)\s*[:฿]?\s*([\d,๐-๙]+(?:\.\d{2})?)/i;
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
  

router.post("/receipt", upload.single("image"), KeyPair.requireAuth(), async (req, res, next): Promise<void> => {
    try {
        const { image } = req.body;
        const uploadedFile = req.file;
        let tempPath: string | null = null;
    
        // Ensure only one input method is provided
        if ((image && uploadedFile) || (!image && !uploadedFile)) {
            res.status(400).json({
              error: "Provide either a base64 image in 'image' field OR a file upload, not both.",
            });
            return;
          }
    
        if (image) {
          // Process base64 image
          const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          tempPath = path.join(__dirname, "temp.png");
          fs.writeFileSync(tempPath, buffer);
        } else if (uploadedFile) {
          // Process uploaded file
          tempPath = uploadedFile.path;
        }
    
        if (!tempPath) {
          res.status(500).json({ error: "Image processing failed." });
          return;
        }
    
        // Perform OCR
        const text = await performOCR(tempPath);
    
        // Delete temporary file
        setTimeout(() => {
            try {
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              } else {
                console.error("File not found:", tempPath);
              }
            } catch (err) {
              console.error("Error deleting file:", err);
            }
          }, 500);
    
        res.json({ text });
      } catch (error) {
        console.error("Error processing OCR:", error);
        next(error);
      }
})

export default router;