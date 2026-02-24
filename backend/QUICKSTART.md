# 🚀 Quick Start Guide - Serbian Land Registry Backend

## Get Up and Running in 5 Minutes!

### Step 1: Install MongoDB

Choose ONE option:

**Option A: Local MongoDB (Recommended for Development)**
```bash
# Windows - Download installer from:
https://www.mongodb.com/try/download/community

# Mac
brew install mongodb-community
brew services start mongodb-community

# Linux (Ubuntu/Debian)
sudo apt-get install mongodb
sudo systemctl start mongod
```

**Option B: MongoDB Atlas (Cloud - Free Tier Available)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster (follow wizard)
4. Get connection string

### Step 2: Setup Project

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your MongoDB connection
# For local: MONGODB_URI=mongodb://localhost:27017/serbia-land-registry
# For Atlas: Use the connection string from Atlas
```

### Step 3: Seed Database with Data

```bash
npm run seed
```

This creates:
- 500 property owners
- 1,000 land parcels
- 150 disputes
- 300 transfers
- 200 mortgages
- System users

### Step 4: Start the Server

```bash
# Development mode (auto-reload)
npm run dev

# OR Production mode
npm start
```

### Step 5: Test It Works!

Open your browser or use curl:
```bash
curl http://localhost:5000/health
```

Should see:
```json
{
  "status": "OK",
  "message": "Serbia Land Registry API is running"
}
```

## 🧪 Test API Endpoints

### Get Dashboard Stats
```bash
curl http://localhost:5000/api/dashboard/stats
```

### Get All Parcels (First Page)
```bash
curl http://localhost:5000/api/parcels?page=1&limit=10
```

### Get Disputes by Region
```bash
curl "http://localhost:5000/api/disputes?region=Belgrade&page=1"
```

### Get Regional Data
```bash
curl http://localhost:5000/api/dashboard/regional-data
```

## 🔗 Connect Your Frontend

In your React frontend `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
```

Example React code:
```javascript
// Fetch dashboard stats
useEffect(() => {
  fetch('http://localhost:5000/api/dashboard/stats?region=Belgrade')
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err));
}, []);
```

## 🎯 What's Next?

1. **Explore the API**: Try different endpoints in the README
2. **Check the Data**: Use MongoDB Compass to view your data visually
3. **Integrate Frontend**: Connect your React app to these endpoints
4. **Customize**: Add more data, modify schemas, create new endpoints

## 🐛 Common Issues

**Can't connect to MongoDB?**
- Check MongoDB is running: `mongosh`
- Verify `.env` connection string
- For Atlas: Check IP whitelist

**Port 5000 in use?**
- Change PORT in `.env` to 5001 or another port

**Seed script fails?**
- Make sure MongoDB is running
- Check console for specific errors
- Try running seed again (it clears old data first)

## 📚 Documentation

- Full README: See `backend/README.md`
- API Endpoints: Listed in README
- Database Schema: Detailed in README

## 🎉 You're Ready!

Your backend is now running with realistic Serbian land registry data. Start building your frontend integration!

---

**Need Help?**
1. Check the full README.md
2. Review error messages in console
3. Test with curl or Postman
