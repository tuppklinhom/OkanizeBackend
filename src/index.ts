import express from 'express';
import 'dotenv/config';
import { app } from './app';
import { sequelize } from './database';
import { User } from './model/User';
import { BudgetNotification } from './model/BudgetNotification';
import { Category } from './model/Category';
import { Goal } from './model/Goal';
import { GroupSpace } from './model/GroupSpace';
import { GroupMember } from './model/GroupMember';
import { GroupTransaction } from './model/GroupTransaction';
import { Transaction } from './model/Transaction';
import { Wallet } from './model/Wallet';
import { UserBudgetLimit } from './model/UserBudgetLimit';
import { FriendList } from './model/FriendList';
import { SchedulerService } from './module/ScheduleService';
const PORT = parseInt(process.env.PORT || '3000');

async function main(){
  sequelize.authenticate()
  .then(() => console.log('Database connection established'))
  .catch((err: Error) => console.error('Unable to connect to the database:', err));
  
  SchedulerService.initScheduledJobs();
const models = [
    User,
    BudgetNotification,
    Category,
    Goal,
    GroupSpace,
    GroupMember,
    GroupTransaction,
    Transaction,
    Wallet,
    UserBudgetLimit,
    FriendList
]

for (const model of models) {
  await model.sync();
}


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
}

main()