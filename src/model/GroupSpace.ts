import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class GroupSpace extends Model<InferAttributes<GroupSpace>, InferCreationAttributes<GroupSpace>> {
    declare space_id: CreationOptional<number>;
    declare name: string;
    declare description: string;
}

GroupSpace.init(
    {
        space_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        description: {
            type: new DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
    },
);
