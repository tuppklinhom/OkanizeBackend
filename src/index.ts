import express from 'express';
import { app } from './app';
import { sequelize } from './database';
import { User } from './model/User';
const PORT = parseInt(process.env.PORT || '3000');

async function main(){sequelize.authenticate()
  .then(() => console.log('Database connection established'))
  .catch((err: Error) => console.error('Unable to connect to the database:', err));
  

const models = [
    User
]

for (const model of models) {
  await model.sync()
}


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
}

main()