import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class CategoryCount extends Model<InferAttributes<CategoryCount>, InferCreationAttributes<CategoryCount>> {
    declare id: CreationOptional<number>;
    declare category_id: CreationOptional<number>;
    declare user_id: number | null;
    declare count: CreationOptional<number>;
}

CategoryCount.init(
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        category_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
        },
        
    },
    {
        sequelize,
    },
);