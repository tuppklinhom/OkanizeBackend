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
    declare wallet_id: CreationOptional<number>;
    declare category_id: CreationOptional<number | null>;
    declare amount: CreationOptional<number>;
    declare type: 'Income' | 'Expense' | 'initial';
    declare date: CreationOptional<Date>;
    declare note: CreationOptional<string>;
    declare receipt_image_base64: CreationOptional<string>;
    declare is_sorted: CreationOptional<boolean>;
    declare is_paid: CreationOptional<boolean>;
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
            allowNull: true,
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
        is_paid: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    },
    {
        sequelize,
    },
);