import cors from 'cors';
import { Express } from 'express';

/**
 * Configure CORS for the Express application
 * @param app Express application instance
 */
export function configureCors(app: Express): void {
  const corsOptions = {
    origin: ['https://okanize.shopsthai.com', 'https://okanize-dev.shopsthai.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'content-type', 'Authorization', 'authorization', 'Access-Token']
  };

  // Apply CORS middleware
  app.use(cors(corsOptions));
  
  // Add preflight handler for complex requests
  app.options('*', cors(corsOptions));
  
  console.log('CORS configured with options:', corsOptions);
}