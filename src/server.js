require('./db'); // initialise DB / seed defaults on startup
const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const { isDemoMode } = require('./priceProvider');
  console.log(`⚡ EV Charging Scheduler running at http://localhost:${PORT}`);
  console.log(`   Price mode : ${isDemoMode() ? 'Demo (local JSON)' : 'Live (API)'}`);
  console.log(`   DB path    : ${process.env.DB_PATH || 'data/ev-scheduler.db'}`);
});
