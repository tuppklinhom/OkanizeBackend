import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class Wallet extends Model<InferAttributes<Wallet>, InferCreationAttributes<Wallet>> {
    declare wallet_id: CreationOptional<number>;
    declare user_id: number;
    declare wallet_name: string;
    declare wallet_type: 'Cash' | 'Credit Card' | 'Bank Transfer';
}

Wallet.init(
    {
        wallet_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        wallet_name: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        wallet_type: {
            type: DataTypes.ENUM('Cash', 'Credit Card', 'Bank Transfer'),
            allowNull: false,
        },
    },
    {
        sequelize,
    },
);
