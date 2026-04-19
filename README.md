# 🕵️ Fsociety ShadowScan - Backend API

This is the backend server for **Fsociety ShadowScan**, a powerful OSINT and digital forensics platform. It handles data extraction, target mapping, and investigative logging.

## 🚀 Features
- **Profile Mapping**: Recursive handle generation and cross-platform profile discovery.
- **Forensic Extraction**: Metadata analysis (EXIF, GPS, Hardware) for images and documents.
- **Telephony Intelligence**: Carrier prefix mapping and HLR ping simulation.
- **Audit Logging**: Comprehensive activity tracking for investigative transparency.

## 🛠️ Tech Stack
- **Runtime**: Node.js & Express
- **Language**: TypeScript
- **Database**: MongoDB
- **Forensics**: Python-based metadata engine

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (running locally or via Atlas)
- Python 3.10+ (for forensic scripts)

### 2. Installation
```bash
# Install dependencies
npm install

# Setup Python environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r src/scripts/requirements.txt
```

### 3. Environment Configuration
Copy the template and fill in your actual credentials:
```bash
cp .env.example .env
```
Ensure you set the following critical variables:
- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_PANEL_SECRET`
- `INITIAL_ADMIN_PASSWORD`

### 4. Running the Server
```bash
# Development mode
npm run dev

# Build for production
npm run build
npm start
```

## 📜 Documentation
- [OSINT Tools Guide](./OSINT_TOOLS_GUIDE.md) - Detailed technical strategies for each forensic tool.

---
*"Democracy is being hacked."* — Fsociety
