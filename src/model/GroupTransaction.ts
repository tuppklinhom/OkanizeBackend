import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class GroupTransaction extends Model<InferAttributes<GroupTransaction>, InferCreationAttributes<GroupTransaction>> {
    declare group_transaction_id: CreationOptional<number>;
    declare space_id: number;
    declare transaction_id: number;
    declare description: string;
    declare split_member: object;
}

GroupTransaction.init(
    {
        group_transaction_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        space_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        transaction_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        description: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        split_member: {
            type: DataTypes.JSON,
            allowNull: false,
        },
    },
    {
        sequelize,
    },
);