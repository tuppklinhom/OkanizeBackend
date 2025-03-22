import { Transaction } from '../model/Transaction';
import { Category } from '../model/Category';
import { User } from '../model/User';
import { Wallet } from '../model/Wallet';
import { Op } from 'sequelize';
import moment from 'moment';

interface DailySummary {
  date: string;
  income: number;
  expense: number;
}

interface CategorySummary {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

// Define the time format type
type TimeFormat = 'week' | 'month' | 'year';

/**
 * Service for generating transaction summaries and visualizations
 */
export class SummaryService {
  /**
   * Generate a daily income/expense summary for the specified date range and time format
   * @param userId - The ID of the user
   * @param timeFormat - Time format to group by (week, month, year)
   * @param startDate - Start date of the summary period (optional)
   * @param endDate - End date of the summary period (optional)
   * @returns Daily summary data
   */
  static async generateDailySummary(
    userId: number,
    timeFormat: TimeFormat,
    startDate?: Date,
    endDate: Date = new Date()
  ): Promise<DailySummary[]> {
    try {
      // Set the appropriate start date and group format based on timeFormat
      let groupFormat: string;
      let labelFormat: string;
      let groupUnit: moment.unitOfTime.DurationConstructor;
      
      if (!startDate) {
        switch (timeFormat) {
          case 'week':
            startDate = moment(endDate).subtract(7, 'days').toDate();
            groupFormat = 'YYYY-MM-DD';
            labelFormat = 'ddd';
            groupUnit = 'day';
            break;
          case 'month':
            startDate = moment(endDate).subtract(1, 'months').toDate();
            groupFormat = 'YYYY-[W]WW'; // Year-Week format
            labelFormat = '[W]W';
            groupUnit = 'week';
            break;
          case 'year':
            startDate = moment(endDate).subtract(1, 'years').toDate();
            groupFormat = 'YYYY-MM';
            labelFormat = 'MMM';
            groupUnit = 'month';
            break;
        }
      } else {
        // If startDate is provided, determine appropriate grouping
        const dayDiff = moment(endDate).diff(moment(startDate), 'days');
        
        if (dayDiff <= 7) {
          timeFormat = 'week';
          groupFormat = 'YYYY-MM-DD';
          labelFormat = 'ddd';
          groupUnit = 'day';
        } else if (dayDiff <= 31) {
          timeFormat = 'month';
          groupFormat = 'YYYY-[W]WW';
          labelFormat = '[W]W';
          groupUnit = 'week';
        } else {
          timeFormat = 'year';
          groupFormat = 'YYYY-MM';
          labelFormat = 'MMM';
          groupUnit = 'month';
        }
      }

      // Get all user's wallets
      const wallets = await Wallet.findAll({ where: { user_id: userId } });
      const walletIds = wallets.map(wallet => wallet.wallet_id);
      
      // Get all transactions for the user's wallets in the date range
      const transactions = await Transaction.findAll({
        where: {
          wallet_id: { [Op.in]: walletIds },
          date: {
            [Op.between]: [startDate, endDate]
          },
          type: { [Op.in]: ['Income', 'Expense'] },
          is_sorted: true
        }
      });
      
      // Group transactions by the appropriate time unit
      const groupedData: { [key: string]: { income: number, expense: number } } = {};
      
      // Initialize all periods in the range
      const currentDate = moment(startDate);
      const lastDate = moment(endDate);
      
      while (currentDate.isSameOrBefore(lastDate, groupUnit)) {
        const periodKey = currentDate.format(groupFormat);
        groupedData[periodKey] = { income: 0, expense: 0 };
        currentDate.add(1, groupUnit);
      }
      
      // Sum transactions by period and type
      for (const transaction of transactions) {
        const periodKey = moment(transaction.date).format(groupFormat);
        
        if (!groupedData[periodKey]) {
          groupedData[periodKey] = { income: 0, expense: 0 };
        }
        
        const amount = parseFloat(transaction.amount as unknown as string);
        
        if (transaction.type === 'Income') {
          groupedData[periodKey].income += amount;
        } else if (transaction.type === 'Expense') {
          groupedData[periodKey].expense += amount;
        }
      }
      
      // Convert to array and ensure it's sorted by date
      return Object.entries(groupedData)
        .map(([date, data]) => ({
          date,
          income: data.income,
          expense: data.expense,
          displayLabel: moment(timeFormat === 'month' ? date.replace('-W', ' ') : date).format(labelFormat)
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(item => ({
          date: item.date,
          income: item.income,
          expense: item.expense,
          displayLabel: item.displayLabel
        }));
    } catch (error) {
      console.error('Error generating daily summary:', error);
      throw error;
    }
  }
  
  /**
   * Generate a category spending summary
   * @param userId - The ID of the user
   * @param timeFormat - Time format to determine period (week, month, year)
   * @param startDate - Start date of the summary period (optional)
   * @param endDate - End date of the summary period (optional)
   * @returns Category summary data
   */
  static async generateCategorySummary(
    userId: number,
    timeFormat: TimeFormat,
    startDate?: Date,
    endDate: Date = new Date()
  ): Promise<CategorySummary[]> {
    try {
      // Set the appropriate start date based on timeFormat if not provided
      if (!startDate) {
        switch (timeFormat) {
          case 'week':
            startDate = moment(endDate).subtract(7, 'days').toDate();
            break;
          case 'month':
            startDate = moment(endDate).subtract(1, 'months').toDate();
            break;
          case 'year':
            startDate = moment(endDate).subtract(1, 'years').toDate();
            break;
        }
      }

      // Get all user's wallets
      const wallets = await Wallet.findAll({ where: { user_id: userId } });
      const walletIds = wallets.map(wallet => wallet.wallet_id);
      
      // Get expense transactions including those with null categories
      const transactions = await Transaction.findAll({
        where: {
          wallet_id: { [Op.in]: walletIds },
          date: {
            [Op.between]: [startDate, endDate]
          },
          type: 'Expense',
          is_sorted: true
        }
      });
      
      // Get all relevant categories (non-null)
      const categoryIds = [...new Set(transactions.map(t => t.category_id).filter(id => id !== null))] as number[];
      const categories = await Category.findAll({
        where: {
          category_id: { [Op.in]: categoryIds }
        }
      });
      
      // Create category map for quick lookups
      const categoryMap = new Map(categories.map(cat => [cat.category_id, cat]));
      
      // Group transactions by category
      const categorySums: { [categoryId: string]: number } = {};
      let totalExpense = 0;
      
      for (const transaction of transactions) {
        const amount = parseFloat(transaction.amount as unknown as string);
        
        // Use 'null' as string key for null category_id
        const categoryKey = transaction.category_id !== null ? 
          transaction.category_id.toString() : 'null';
        
        if (!categorySums[categoryKey]) {
          categorySums[categoryKey] = 0;
        }
        
        categorySums[categoryKey] += amount;
        totalExpense += amount;
      }
      
      // Generate colors for categories
      const colors = [
        '#4285F4', // Blue
        '#34A853', // Green
        '#FBBC05', // Yellow
        '#EA4335', // Red
        '#8AB4F8', // Light blue
        '#137333', // Dark green
        '#F9AB00', // Orange
        '#D93025', // Dark red
        '#81C995', // Light green
        '#F6C2C6'  // Light red
      ];
      
      // Create summary
      const summary: CategorySummary[] = Object.entries(categorySums).map(([categoryId, amount], index) => {
        // Special handling for null category
        if (categoryId === 'null') {
          return {
            name: 'Others',
            amount,
            percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
            color: '#CCCCCC' // Gray color for Others category
          };
        }
        
        const category = categoryMap.get(parseInt(categoryId));
        return {
          name: category ? category.name : 'Uncategorized',
          amount,
          percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
          color: colors[index % colors.length]
        };
      });
      
      // Sort by amount (descending)
      return summary.sort((a, b) => b.amount - a.amount);
    } catch (error) {
      console.error('Error generating category summary:', error);
      throw error;
    }
  }
  
  /**
   * Generate a bar chart URL for daily income/expense using QuickChart.io
   * @param dailySummary - Daily summary data
   * @param timeFormat - Time format used (week, month, year)
   * @returns Chart URL
   */
  static generateBarChartUrl(dailySummary: DailySummary[], timeFormat: TimeFormat = 'week'): string {
    // Use displayLabel if available, otherwise use date formatted based on timeFormat
    const labels = dailySummary.map(day => {
      if ('displayLabel' in day) {
        return (day as any).displayLabel;
      }
      
      // Format based on timeFormat
      const date = moment(day.date);
      switch (timeFormat) {
        case 'week':
          return date.format('ddd');
        case 'month':
          return `W${date.format('W')}`;
        case 'year':
          return date.format('MMM');
        default:
          return date.format('ddd');
      }
    });
    
    const incomeData = dailySummary.map(day => day.income);
    const expenseData = dailySummary.map(day => day.expense);
    
    // Find the maximum value for y-axis scaling
    const maxValue = Math.max(...incomeData, ...expenseData);
    const yAxisMax = Math.ceil(maxValue * 1.1 / 500) * 500; // Round up to nearest 500
    
    const chartData = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'รายรับ',
            backgroundColor: '#34A853',
            data: incomeData
          },
          {
            label: 'รายจ่าย',
            backgroundColor: '#EA4335',
            data: expenseData
          }
        ]
      },
      options: {
        legend: { position: 'top' },
        scales: { 
          yAxes: [{ 
            ticks: { 
              beginAtZero: true,
              max: yAxisMax
            } 
          }] 
        },
        plugins: {
          datalabels: {
            display: false
          }
        }
      }
    };
    
    // Encode the chart configuration as URL-safe base64
    const encodedConfig = encodeURIComponent(JSON.stringify(chartData));
    return `https://quickchart.io/chart?c=${encodedConfig}&w=700&h=300&bkg=white`;
  }
  
  /**
   * Generate a pie chart URL for category spending using QuickChart.io
   * @param categorySummary - Category summary data
   * @returns Chart URL
   */
  static generatePieChartUrl(categorySummary: CategorySummary[]): string {
    // Take top 5 categories only
    const topCategories = categorySummary.slice(0, 5);
    
    // If there are more categories, add an "Others" category
    let otherPercentage = 0;
    if (categorySummary.length > 5) {
      otherPercentage = categorySummary.slice(5).reduce((sum, cat) => sum + cat.percentage, 0);
    }
    
    const chartData = {
      type: 'pie',
      data: {
        labels: [...topCategories.map(cat => cat.name), otherPercentage > 0 ? 'อื่นๆ' : ''].filter(l => l),
        datasets: [{
          data: [...topCategories.map(cat => cat.percentage), otherPercentage].filter(v => v > 0),
          backgroundColor: [...topCategories.map(cat => cat.color), '#CCCCCC'].slice(0, topCategories.length + (otherPercentage > 0 ? 1 : 0))
        }]
      },
      options: {
        plugins: {
          datalabels: {
            formatter: (value: number) => {
              return value.toFixed(1) + '%';
            },
            color: 'white',
            font: {
              weight: 'bold',
              size: 10
            }
          }
        },
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            fontSize: 10
          }
        }
      }
    };
    
    const encodedConfig = encodeURIComponent(JSON.stringify(chartData));
    return `https://quickchart.io/chart?c=${encodedConfig}&w=300&h=300&bkg=white`;
  }
  
  /**
   * Generate Line message with visual summary
   * @param userId - The ID of the user
   * @param timeFormat - Time format to use (week, month, year)
   * @returns Line message content
   */
  static async generateSummaryMessage(userId: number, timeFormat: TimeFormat = 'month'): Promise<any> {
    try {
      const user = await User.findOne({ where: { user_id: userId } });
      if (!user) {
        throw new Error('User not found');
      }
      
      const endDate = new Date();
      let startDate: Date;
      
      switch (timeFormat) {
        case 'week':
          startDate = moment(endDate).subtract(7, 'days').toDate();
          break;
        case 'month':
          startDate = moment(endDate).subtract(1, 'months').toDate();
          break;
        case 'year':
          startDate = moment(endDate).subtract(1, 'years').toDate();
          break;
        default:
          startDate = moment(endDate).subtract(1, 'months').toDate(); // Default to month
      }
      
      // Get daily and category summaries
      const dailySummary = await this.generateDailySummary(userId, timeFormat, startDate, endDate);
      const categorySummary = await this.generateCategorySummary(userId, timeFormat, startDate, endDate);
      
      // Generate chart URLs
      const barChartUrl = this.generateBarChartUrl(dailySummary, timeFormat);
      const pieChartUrl = this.generatePieChartUrl(categorySummary);
      
      // Create labels for the time periods
      const periodLabels = dailySummary.map(day => {
        if ('displayLabel' in day) {
          return (day as any).displayLabel;
        }
        return moment(day.date).format('ddd');
      });
      
      // Summary title based on time format
      let summaryTitle: string;
      let periodType: string;
      
      switch (timeFormat) {
        case 'week':
          summaryTitle = "Weekly Financial Summary";
          periodType = "รายวัน";
          break;
        case 'month':
          summaryTitle = "Monthly Financial Summary";
          periodType = "รายสัปดาห์";
          break;
        case 'year':
          summaryTitle = "Annual Financial Summary";
          periodType = "รายเดือน";
          break;
        default:
          summaryTitle = "Financial Summary";
          periodType = "รายวัน";
      }
      
      // Create Line Flex message with charts
      return {
        type: "flex",
        altText: summaryTitle,
        contents: {
          type: "bubble",
          size: "giga",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: summaryTitle,
                weight: "bold",
                size: "xl",
                color: "#000000"
              },
              {
                type: "text",
                text: `${moment(startDate).format('MMM DD')} - ${moment(endDate).format('MMM DD, YYYY')}`,
                size: "sm",
                color: "#888888"
              }
            ],
            paddingBottom: "md"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `รายรับรายจ่าย${periodType}`,
                weight: "bold",
                size: "md",
                color: "#000000",
                margin: "md"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "box",
                    layout: "vertical",
                    contents: [
                      {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          {
                            type: "box",
                            layout: "vertical",
                            contents: [],
                            backgroundColor: "#34A853",
                            width: "16px",
                            height: "16px"
                          },
                          {
                            type: "text",
                            text: "รายรับ",
                            size: "xs"
                          }
                        ]
                      },
                      {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                          {
                            type: "box",
                            layout: "vertical",
                            contents: [],
                            backgroundColor: "#EA4335",
                            width: "16px",
                            height: "16px"
                          },
                          {
                            type: "text",
                            text: "รายจ่าย",
                            size: "xs"
                          }
                        ]
                      }
                    ],
                    width: "30%"
                  }
                ],
                margin: "sm"
              },
              {
                type: "image",
                url: barChartUrl,
                size: "full",
                aspectMode: "fit",
                aspectRatio: "2:1",
                margin: "md"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: periodLabels.map(label => ({
                  type: "text",
                  text: label,
                  size: "xs",
                  align: "center",
                  gravity: "center",
                  flex: 1
                })),
                margin: "sm"
              },
              {
                type: "separator",
                margin: "lg"
              },
              {
                type: "text",
                text: "หมวดหมู่ค่าใช้จ่าย",
                weight: "bold",
                size: "md",
                margin: "lg"
              },
              {
                type: "box",
                layout: "horizontal",
                contents: [
                  {
                    type: "image",
                    url: pieChartUrl,
                    size: "sm",
                    flex: 1,
                    aspectRatio: "1:1",
                    aspectMode: "fit"
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    contents: categorySummary.slice(0, 5).map((cat, index) => ({
                      type: "box",
                      layout: "horizontal",
                      contents: [
                        {
                          type: "box",
                          layout: "vertical",
                          contents: [],
                          backgroundColor: cat.color,
                          width: "16px",
                          height: "16px"
                        },
                        {
                          type: "text",
                          text: `${cat.name.substring(0, 10)}${cat.name.length > 10 ? '...' : ''}: ${cat.percentage.toFixed(1)}%`,
                          size: "xs",
                          margin: "sm"
                        }
                      ],
                      margin: "sm"
                    })),
                    flex: 1
                  }
                ],
                margin: "md"
              }
            ],
            paddingAll: "md"
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                action: {
                  type: "uri",
                  label: "View Details",
                  uri: "https://okanize.shopsthai.com/dashboard"
                },
                style: "primary",
              }
            ]
          }
        }
      };
    } catch (error) {
      console.error('Error generating summary message:', error);
      throw error;
    }
  }
  
  /**
   * Send a summary message to the user via Line
   * @param userId - The user ID
   */
  static async sendSummaryMessage(userId: number): Promise<void> {
    try {
      const user = await User.findOne({ where: { user_id: userId } });
      if (!user || !user.line_id) {
        throw new Error('User not found or has no Line ID');
      }
      
      // Generate message with a 30-day summary (use month timeFormat)
      const messageContent = await this.generateSummaryMessage(userId, 'month');
      
      const messagePayload = {
        to: user.line_id,
        messages: [messageContent]
      };
      
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN || ""}`
        },
        body: JSON.stringify(messagePayload),
      });
      
      const data = await response.json();
      console.log('Push Message Response:', data);
    } catch (error) {
      console.error('Error sending summary message:', error);
      throw error;
    }
  }
}