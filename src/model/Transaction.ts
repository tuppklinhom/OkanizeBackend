import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class Transaction extends Model<InferAttributes<Transaction>, InferCreationAttributes<Transaction>> {
    declare transaction_id: CreationOptional<number>;
    declare wallet_id: number;
    declare category_id: CreationOptional<number | null>;
    declare amount: number;
    declare type: 'Income' | 'Expense' | 'initial';
    declare date: Date;
    declare note: string;
    declare receipt_image_base64: string;
    declare is_sorted: boolean;
}

Transaction.init(
    {
        transaction_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        wallet_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        category_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM('Income', 'Expense', 'initial'),
            allowNull: false,
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        note: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        receipt_image_base64: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        is_sorted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
    },
    {
        sequelize,
    },
);