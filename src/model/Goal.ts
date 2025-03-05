import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class Goal extends Model<InferAttributes<Goal>, InferCreationAttributes<Goal>> {
    declare goal_id: CreationOptional<number>;
    declare user_id: number;
    declare name: string;
    declare target_amount: number;
    declare start_date: Date;
    declare end_date: Date;
}

Goal.init(
    {
        goal_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        name: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        target_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        start_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        end_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        sequelize,
    },
);