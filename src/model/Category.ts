import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize';
import { sequelize } from '../database';

export class Category extends Model<InferAttributes<Category>, InferCreationAttributes<Category>> {
    declare category_id: CreationOptional<number>;
    declare user_id: number;
    declare name: string;
    declare budget_limit: number;
    declare image_base64: string;
}

Category.init(
    {
        category_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        name: {
            type: new DataTypes.STRING(255),
            allowNull: false,
        },
        budget_limit: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        image_base64: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
    },
    {
        sequelize,
    },
);