import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class GroupMember extends Model<InferAttributes<GroupMember>, InferCreationAttributes<GroupMember>> {
    declare group_member_id: CreationOptional<number>;
    declare space_id: number;
    declare user_id: number;
    declare role: 'Admin' | 'Member';
}

GroupMember.init(
    {
        group_member_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        space_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('Admin', 'Member'),
            allowNull: false,
        },
    },
    {
        sequelize,
    },
);