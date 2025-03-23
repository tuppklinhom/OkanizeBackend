import cors from 'cors';
import { Express } from 'express';

/**
 * Configure CORS for the Express application
 * @param app Express application instance
 */
export function configureCors(app: Express): void {
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || origin === 'https://okanize.shopsthai.com' || origin === 'https://okanize-dev.shopsthai.com') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
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