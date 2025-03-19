
import {
    Model,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
    DataTypes,
} from 'sequelize'
import { sequelize } from '../database'
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare user_id: CreationOptional<number>;
    declare username: CreationOptional<string>;
    declare line_id: string
    declare default_category: CreationOptional<number | null>;
    declare default_wallet: CreationOptional<number>;
    declare profile_image_base64: CreationOptional<string>;
}
User.init(
    {
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        username: {
            type: new DataTypes.STRING(64),
            allowNull: true,
        },
        line_id: {
            type: new DataTypes.STRING(128),
            allowNull: false,
        },
        default_category: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true, // Can be null if no category is set
        },
        default_wallet:{
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true, 
        },
        profile_image_base64:{
            type: DataTypes.TEXT,
            allowNull: true
        }
        
    },
    {
        sequelize,
    },
)