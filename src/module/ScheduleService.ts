import cron from 'node-cron';
import { User } from '../model/User';
import { SummaryService } from './SummaryServices';
import { Op } from 'sequelize';

/**
 * This module sets up scheduled tasks for sending summary messages
 */
export class SchedulerService {
  /**
   * Start all scheduled tasks
   */
  static initScheduledJobs(): void {
    this.scheduleEndOfMonthSummary();
    console.log('All scheduled jobs initialized');
  }


  /**
   * Schedule monthly summary messages to be sent at the end of each month
   * Runs at 8:00 PM on the last day of each month
   */
  static scheduleEndOfMonthSummary(): void {
    // Cron pattern: '0 20 L * *' = At 8:00 PM on the last day of each month, now using every end of day
    cron.schedule('0 20 * * *', async () => {
      console.log('Running monthly summary job at', new Date().toISOString());
      try {
        // Get all active users
        const users = await User.findAll();

        console.log(`Found ${users.length} users to send monthly summaries`);

        // Send summaries to each user
        for (const user of users) {
          try {
            await SummaryService.sendSummaryMessage(user.user_id);
            console.log(`Successfully sent monthly summary to user ${user.user_id}`);
          } catch (error) {
            console.error(`Failed to send monthly summary to user ${user.user_id}:`, error);
            // Continue with next user even if one fails
          }
        }

        console.log('Monthly summary job completed');
      } catch (error) {
        console.error('Error running monthly summary job:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Bangkok" // Adjust timezone as needed
    });
  }
}