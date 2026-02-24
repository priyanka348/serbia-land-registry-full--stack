# Serbian National Digital Land Registry - Backend API

Complete MongoDB + Express backend for the Serbian Land Registry System with blockchain-backed trust and audit trails.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Seeding Data](#seeding-data)

## ✨ Features

- **Land Parcel Management**: Complete CRUD operations for land parcels
- **Ownership Tracking**: Full ownership history with blockchain verification
- **Dispute Management**: Track and manage land disputes
- **Transfer Processing**: Handle property transfers with approval workflow
- **Mortgage Management**: Track mortgages and financial encumbrances
- **Audit Logging**: Complete audit trail of all system actions
- **Multi-role Access**: Support for Ministers, Registrars, Judges, Auditors
- **Regional Analytics**: Regional breakdown and statistics
- **Blockchain Integration**: Hash-based verification system

## 🛠 Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Authentication**: JWT + bcrypt
- **Environment**: dotenv

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── Parcel.js            # Land parcel schema
│   ├── Owner.js             # Owner schema
│   ├── OwnershipHistory.js  # Ownership records
│   ├── Transfer.js          # Property transfers
│   ├── Dispute.js           # Land disputes
│   ├── Mortgage.js          # Mortgage records
│   ├── User.js              # System users
│   ├── AuditLog.js          # Audit trail
│   └── index.js             # Model exports
├── routes/
│   ├── parcels.js           # Parcel endpoints
│   ├── owners.js            # Owner endpoints
│   ├── disputes.js          # Dispute endpoints
│   ├── transfers.js         # Transfer endpoints
│   ├── mortgages.js         # Mortgage endpoints
│   ├── users.js             # User endpoints
│   ├── audit.js             # Audit endpoints
│   └── dashboard.js         # Analytics endpoints
├── seed/
│   └── seedDatabase.js      # Database seeding script
├── .env.example             # Environment template
├── package.json
└── server.js                # Main server file
```

## 📦 Prerequisites

Before you begin, ensure you have installed:

- **Node.js** (v18 or higher)
- **MongoDB** (v5.0 or higher)
  - Local installation OR
  - MongoDB Atlas account (cloud)
- **npm** or **yarn**

## 🚀 Installation

### 1. Clone or Navigate to Backend Directory

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Edit `.env` file:

```env
# For Local MongoDB
MONGODB_URI=mongodb://localhost:27017/serbia-land-registry

# For MongoDB Atlas (Cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/serbia-land-registry

PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_key_change_this_in_production
FRONTEND_URL=http://localhost:5173
```

## 💾 Database Setup

### Option 1: Local MongoDB

1. **Install MongoDB** (if not already installed):
   - **Windows**: Download from [mongodb.com](https://www.mongodb.com/try/download/community)
   - **Mac**: `brew install mongodb-community`
   - **Linux**: Follow [official guide](https://docs.mongodb.com/manual/administration/install-on-linux/)

2. **Start MongoDB Service**:
   ```bash
   # Windows (run as admin)
   net start MongoDB
   
   # Mac
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

3. **Verify MongoDB is running**:
   ```bash
   mongosh
   # Should connect successfully
   ```

### Option 2: MongoDB Atlas (Cloud)

1. **Create Account**: Go to [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Cluster**: Follow the setup wizard
3. **Get Connection String**:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<username>` and `<password>` with your credentials
4. **Update `.env`**: Paste the connection string into `MONGODB_URI`

## 🌱 Seeding Data

Populate the database with realistic Serbian land registry data:

```bash
npm run seed
```

This will create:
- **500 Owners** (individuals and corporations)
- **1000 Land Parcels** across all Serbian regions
- **~2000 Ownership History** records
- **150 Disputes** (various statuses)
- **300 Transfers** (various stages)
- **200 Mortgages**
- **System Users** (Minister, Registrars, Judges, Auditors)

### Test User Credentials

After seeding, you can use these accounts:

| Role | Email | Password |
|------|-------|----------|
| Minister | minister@land.gov.rs | Minister@123 |
| Registrar (Belgrade) | registrar.belgrade@land.gov.rs | Registrar@123 |
| Judge | judge@land.gov.rs | Judge@123 |
| Auditor | auditor@land.gov.rs | Auditor@123 |

## ▶️ Running the Server

### Development Mode (with auto-reload):

```bash
npm run dev
```

### Production Mode:

```bash
npm start
```

The server will start on `http://localhost:5000`

### Verify Server is Running:

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Serbia Land Registry API is running",
  "timestamp": "2024-02-13T..."
}
```

## 🔌 API Endpoints

### Dashboard & Analytics

```
GET  /api/dashboard/stats              # Overall statistics
GET  /api/dashboard/regional-data      # Data by region
GET  /api/dashboard/trends             # Time series data
GET  /api/dashboard/affordability      # Affordability metrics
```

### Land Parcels

```
GET  /api/parcels                      # Get all parcels (paginated)
GET  /api/parcels/:id                  # Get single parcel with history
```

Query parameters:
- `region` - Filter by region
- `legalStatus` - Filter by status (verified, disputed, etc.)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by parcel ID or city

### Disputes

```
GET  /api/disputes                     # Get all disputes (paginated)
GET  /api/disputes/:id                 # Get single dispute
GET  /api/disputes/stats/summary       # Dispute statistics
```

Query parameters:
- `region` - Filter by region
- `status` - Filter by status (Open, Investigation, Court, Resolved)
- `priority` - Filter by priority

### Transfers

```
GET  /api/transfers                    # Get all transfers (paginated)
GET  /api/transfers/:id                # Get single transfer
```

Query parameters:
- `region` - Filter by region
- `status` - Filter by status

### Mortgages

```
GET  /api/mortgages                    # Get all mortgages (paginated)
GET  /api/mortgages/:id                # Get single mortgage
```

### Owners

```
GET  /api/owners                       # Get all owners (paginated)
GET  /api/owners/:id                   # Get single owner
```

### Users

```
GET  /api/users                        # Get all users
```

### Audit Logs

```
GET  /api/audit/logs                   # Get audit logs (paginated)
```

Query parameters:
- `eventType` - Filter by event type
- `severity` - Filter by severity
- `startDate` - Filter from date
- `endDate` - Filter to date

## 📊 Database Schema

### Main Collections:

1. **Parcels** - Land parcel records with location, ownership, legal status
2. **Owners** - Individual and corporate property owners
3. **OwnershipHistory** - Complete ownership transfer records
4. **Transfers** - Active property transfer applications
5. **Disputes** - Land dispute cases
6. **Mortgages** - Mortgage and lien records
7. **Users** - System users with roles and permissions
8. **AuditLogs** - Complete audit trail of all actions

### Key Features:

- **Blockchain Hashing**: All critical records include blockchain hash for verification
- **Audit Trail**: Every change is logged with user, timestamp, and details
- **Soft Deletes**: Records are marked inactive rather than deleted
- **Comprehensive Indexing**: Optimized queries for common searches
- **Relationships**: Proper references between all entities

## 🔧 Connecting Frontend

Update your frontend `.env` file:

```env
VITE_API_URL=http://localhost:5000/api
```

Example API call from frontend:

```javascript
// Fetch dashboard stats
const response = await fetch('http://localhost:5000/api/dashboard/stats?region=Belgrade');
const data = await response.json();
console.log(data);
```

## 🐛 Troubleshooting

### MongoDB Connection Issues

**Error**: "MongooseServerSelectionError"

**Solutions**:
1. Check MongoDB is running: `mongosh`
2. Verify connection string in `.env`
3. For Atlas: Check IP whitelist settings
4. Check firewall settings

### Port Already in Use

**Error**: "Port 5000 is already in use"

**Solution**: Change port in `.env`:
```env
PORT=5001
```

### Seeding Fails

**Error**: Various seeding errors

**Solutions**:
1. Ensure MongoDB is running
2. Clear existing data: `npm run seed` (it clears automatically)
3. Check console for specific error messages

## 📝 Development Tips

### Add New Model

1. Create model file in `models/`
2. Add to `models/index.js`
3. Create route file in `routes/`
4. Add route to `server.js`

### Debugging

Enable detailed logging:
```javascript
// In server.js
mongoose.set('debug', true);
```

### Testing API

Use tools like:
- **Postman**: GUI-based API testing
- **Thunder Client**: VS Code extension
- **curl**: Command-line testing

## 📄 License

This project is part of the Serbian National Digital Land Registry initiative.

## 👥 Support

For issues or questions:
1. Check the troubleshooting section
2. Review MongoDB and Express documentation
3. Check console logs for detailed error messages

---

**Ready to Go!** 🚀

1. Install dependencies: `npm install`
2. Configure `.env` file
3. Seed database: `npm run seed`
4. Start server: `npm run dev`
5. Test API: `http://localhost:5000/health`
