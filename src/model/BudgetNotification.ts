import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class BudgetNotification extends Model<InferAttributes<BudgetNotification>, InferCreationAttributes<BudgetNotification>> {
    declare notification_id: CreationOptional<number>;
    declare user_id: number;
    declare category_id: number;
    declare type: 'Warning' | 'Exceed' | 'Others';
    declare date: Date;
    declare message: string;
    declare is_read: boolean;
}

BudgetNotification.init(
    {
        notification_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        category_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        type: {
            type: DataTypes.ENUM('Warning', 'Exceed', 'Others'),
            allowNull: false,
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        message: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        is_read: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
    },
    {
        sequelize,
    },
);