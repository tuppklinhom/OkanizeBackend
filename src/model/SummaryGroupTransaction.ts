import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class SummaryGroupTransaction extends Model<InferAttributes<SummaryGroupTransaction>, InferCreationAttributes<SummaryGroupTransaction>> {
    declare id: CreationOptional<number>;
    declare user_id: number;
    declare target_id: number;
    declare transaction_ids: object;
    declare description: string;
    declare amount: number
}

SummaryGroupTransaction.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        target_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        transaction_ids: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        description: {
            type: new DataTypes.STRING(255),
            allowNull: true,
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        }
    },
    {
        sequelize,
    },
);