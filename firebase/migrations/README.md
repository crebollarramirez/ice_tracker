# Firebase Data Migration Script

This script migrates data from both Firebase Realtime Database and Firestore by:

1. **Consolidating duplicate addresses** using the `makeAddressKey` function
2. **Adding a `reported` field** that counts how many times each address was reported
3. **Eliminating duplicates** while preserving the report count

## Data Structure

### Input Format

```typescript
{
  addedAt: string;
  additionalInfo: string;
  address: string;
  lat: number;
  lng: number;
}
```

### Output Format

```typescript
{
  addedAt: string;
  additionalInfo: string;
  address: string;
  lat: number;
  lng: number;
  reported: number; // New field counting duplicates
}
```

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your Firebase configuration
   ```

3. **Authentication:**
   - For local development, you can use Firebase CLI authentication:
     ```bash
     firebase login
     ```
   - Or set up a service account key and set `GOOGLE_APPLICATION_CREDENTIALS` in `.env`

## Usage

⚠️ **Important**: This script will **replace all existing data** in both databases. Make sure to backup your data first!

### Run the migration:

```bash
npm run migrate
```

### Or run directly with ts-node:

```bash
npx ts-node --esm migrations.ts
```

## What the script does:

1. **Reads data** from both Realtime Database and Firestore
2. **Processes each record** to create consistent address keys using `makeAddressKey()`
3. **Consolidates duplicates** by counting how many times each address appears
4. **Merges data** from both databases, combining report counts for addresses that appear in both
5. **Writes the consolidated data** back to both databases with new keys and report counts

## Example Output:

```
🚀 Starting Firebase data migration...
=====================================
🔄 Starting Realtime Database migration...
✅ Processed 150 records from Realtime Database
📊 Consolidated to 95 unique addresses
🔄 Starting Firestore migration...
✅ Processed 75 documents from Firestore
📊 Consolidated to 60 unique addresses
🔄 Merging consolidated data from both databases...
📊 Final consolidated data: 120 unique addresses

📊 Migration Summary:
=====================================
Total unique addresses: 120

🔥 Most reported addresses:
  123 main st - 5 reports
  456 oak ave - 3 reports
  789 pine rd - 2 reports

🎉 Migration completed successfully!
=====================================
```

## Configuration

You can adjust the following in the script:

- **Database paths**: Modify the `ref` path in `migrateRealtimeDatabase()`
- **Collection names**: Change the collection name in `migrateFirestore()`
- **Data validation**: Add custom validation logic for your specific data requirements
- **Confirmation step**: Comment out the confirmation logic for automated execution

## Safety Features

- **Dry run capability**: The script shows a summary before writing data
- **Detailed logging**: See exactly what's being processed and consolidated
- **Error handling**: Proper error handling and cleanup
- **Data validation**: Skips records with missing or invalid addresses
