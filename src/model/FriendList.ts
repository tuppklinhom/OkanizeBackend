import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class FriendList extends Model<InferAttributes<FriendList>, InferCreationAttributes<FriendList>> {
    declare id: CreationOptional<number>;
    declare user_id: number;
    declare friend_user_id: number;
}

FriendList.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        friend_user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
    },
    {
        sequelize,
    },
);