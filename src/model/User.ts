
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
    declare name: string;
    declare email: string;
    declare password: string;
    declare line_bot_id?: string;
    declare default_category?: CreationOptional<number | null>;
    declare default_wallet: number;
    declare profile_image_base64: CreationOptional<string>;
}
User.init(
    {
        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: new DataTypes.STRING(64),
            allowNull: false,
        },
        email: {
            type: new DataTypes.STRING(128),
            allowNull: false,
            unique: true,
        },
        password: {
            type: new DataTypes.STRING(128),
            allowNull: false,
        },
        line_bot_id: {
            type: new DataTypes.STRING(64),
            allowNull: true,
        },
        default_category: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true, // Can be null if no category is set
        },
        default_wallet:{
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false, 
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