import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DATABASE_NAME || '',
  process.env.DATABASE_USER || '',
  process.env.DATABASE_PASSWORD || '',
  {
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 5432,
    username: String(process.env.DATABASE_USER),
    password: String(process.env.DATABASE_PASSWORD),
    dialect: 'postgres',
  }
);

