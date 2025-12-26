# Instagram Account Tracker

A full-stack web application to track Instagram accounts, monitoring followers, following, and mutual friends with hourly updates.

## Features

- 🔐 **Secure Authentication**: Username/password login with JWT
- 📊 **Multiple Account Tracking**: Track unlimited Instagram accounts
- 📈 **Daily Delta Charts**: Visualize daily changes (not cumulative)
- 🔄 **Hourly Polling**: Automatic checks every hour
- 📋 **Recent Activity**: Last 10 changes for each category
- 📥 **CSV Export**: Export complete datasets
- 🔗 **Direct Links**: Click usernames to view Instagram profiles

## Prerequisites

- Docker and Docker Compose installed
- Ports 3000, 5000, and 27017 available

## Installation & Setup

### Step 1: Clone or Download Project

Ensure all files are in the correct directory structure as shown in the project layout.

### Step 2: Build Docker Images

From the project root directory:
```bash
docker-compose build
```

This will build:
- Backend Node.js application
- Frontend React application
- MongoDB database container

### Step 3: Start the Application
```bash
docker-compose up -d
```

The `-d` flag runs containers in detached mode (background).

### Step 4: Verify Services

Check that all containers are running:
```bash
docker-compose ps
```

You should see three services running:
- `instagram-tracker-frontend` (port 3000)
- `instagram-tracker-backend` (port 5000)
- `instagram-tracker-mongodb` (port 27017)

### Step 5: Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

### Step 6: Initial Setup

On first launch:
1. You'll see a setup page
2. Create your username and password (minimum 6 characters)
3. Click "Create Account"
4. You'll be automatically logged in

## Usage

### Adding Instagram Accounts

1. Click "Add Account" on the dashboard
2. Enter the Instagram username (without @)
3. Click "Add Account"
4. The system will fetch initial data and start tracking

### Viewing Account Details

1. Click on any tracked account card
2. View three sections:
   - **Followers**: Daily changes and recent activity
   - **Following**: Daily changes and recent activity
   - **Mutual Friends**: Daily changes and recent activity
3. Each section shows:
   - Line chart with daily deltas
   - Last 10 changes with timestamps
   - Instagram profile links

### Exporting Data

**Per Category:**
- Click "Export CSV" button in any section (Followers/Following/Mutual Friends)

**All Data:**
- Click "Export All Data" button at top of account page

### Managing Settings

1. Click "Settings" in the navigation
2. Change your password
3. Log out

### Removing Accounts

1. Go to account detail page
2. Click "Remove Account" button
3. Confirm deletion

## How It Works

### Data Collection

1. **Initial Fetch**: When adding an account, the system fetches current followers/following
2. **Hourly Checks**: Every hour, the scheduler polls all tracked accounts
3. **Change Detection**: Compares current data with previous snapshot
4. **Event Recording**: Logs all additions and removals with timestamps

### Daily Aggregation

- Charts display **net change per day** (added - removed)
- Not cumulative totals
- Calculated from timestamped events

### Data Storage

All data persists in MongoDB:
- **User**: Authentication credentials
- **TrackedAccount**: Current state of each Instagram account
- **ChangeEvent**: Historical log of all changes

## Docker Commands

### View Logs

**All services:**
```bash
docker-compose logs -f
```

**Specific service:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Stop Application
```bash
docker-compose down
```

### Stop and Remove Volumes (Delete All Data)
```bash
docker-compose down -v
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild After Code Changes
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## Development Mode

To run without Docker for development:

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

### MongoDB

You'll need MongoDB running locally or update `MONGODB_URI` in `.env`

## Important Notes

### Instagram Scraping Limitations

- Instagram actively blocks automated scraping
- This implementation uses mock data for demonstration
- For production, use Instagram's official Graph API or third-party services
- Current implementation will work but may encounter rate limits

### Security Recommendations for Production

1. **Change JWT Secret**: Update `JWT_SECRET` in `docker-compose.yml` to a strong random string
2. **Use HTTPS**: Deploy behind a reverse proxy with SSL
3. **Secure MongoDB**: Add authentication to MongoDB
4. **Environment Variables**: Use proper secrets management
5. **Rate Limiting**: Add rate limiting to API endpoints

### Port Configuration

If ports 3000, 5000, or 27017 are in use, modify `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:80"    # Frontend
  - "YOUR_PORT:5000"  # Backend
  - "YOUR_PORT:27017" # MongoDB
```

## Troubleshooting

### Frontend Can't Connect to Backend

1. Check backend logs: `docker-compose logs backend`
2. Verify backend is running: `curl http://localhost:5000/api/health`
3. Check CORS configuration in `backend/src/server.js`

### MongoDB Connection Failed

1. Ensure MongoDB container is running: `docker-compose ps`
2. Check MongoDB logs: `docker-compose logs mongodb`
3. Verify volume permissions

### Scheduler Not Running

1. Check backend logs for "Scheduler started" message
2. Verify cron expression in `schedulerService.js`
3. Check for errors in hourly job execution

### Data Not Persisting

1. Verify MongoDB volume is created: `docker volume ls`
2. Check volume mount in `docker-compose.yml`
3. Don't use `docker-compose down -v` unless you want to delete data

## Architecture
```
┌─────────────────┐
│   React App     │ (Port 3000)
│   (Nginx)       │
└────────┬────────┘
         │
         │ HTTP/API
         │
┌────────▼────────┐
│  Express API    │ (Port 5000)
│  Node.js        │
└────────┬────────┘
         │
         │ Mongoose
         │
┌────────▼────────┐
│   MongoDB       │ (Port 27017)
│                 │
└─────────────────┘
```

## Tech Stack

**Frontend:**
- React 18
- React Router
- Recharts (charts)
- Axios (API client)
- date-fns (date formatting)

**Backend:**
- Node.js
- Express
- MongoDB + Mongoose
- JWT authentication
- node-cron (scheduler)
- json2csv (exports)

**Infrastructure:**
- Docker
- Docker Compose
- Nginx

## File Structure
```
instagram-tracker/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── TrackedAccount.js
│   │   │   └── ChangeEvent.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── accounts.js
│   │   │   └── export.js
│   │   ├── services/
│   │   │   ├── instagramService.js
│   │   │   └── schedulerService.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   └── server.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── AccountView.jsx
│   │   │   ├── Settings.jsx
│   │   │   ├── DataSection.jsx
│   │   │   └── Chart.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.jsx
│   │   └── index.css
│   ├── nginx.conf
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## License

This project is provided as-is for educational purposes.