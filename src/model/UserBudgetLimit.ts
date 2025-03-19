import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class UserBudgetLimit extends Model<InferAttributes<UserBudgetLimit>, InferCreationAttributes<UserBudgetLimit>> {
    declare id: CreationOptional<number>;
    declare category_id: number;
    declare user_id: number;
    declare budget_limit: number;
}

UserBudgetLimit.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        category_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        budget_limit: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },

    },
    {
        sequelize,
    },
);