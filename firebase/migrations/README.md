# Firebase Data Migration and Statistics Tool

This script is designed to:

1. **Migrate data** from Firebase Realtime Database and Firestore.
2. **Consolidate duplicate addresses** by creating unique keys using the `makeAddressKey` function.
3. **Add a `reported` field** to count how many times each address was reported.
4. **Recalculate statistics** for pins stored in both databases.

## Data Structure

### Input Format

#### Realtime Database

```typescript
{
  addedAt: string; // Timestamp when the record was added
  additionalInfo: string; // Optional additional information
  address: string; // Address of the location
  lat: number; // Latitude of the location
  lng: number; // Longitude of the location
}
```

#### Firestore

```typescript
{
  addedAt: string; // Timestamp when the record was added
  additionalInfo: string; // Optional additional information
  address: string; // Address of the location
  lat: number; // Latitude of the location
  lng: number; // Longitude of the location
}
```

### Output Format

```typescript
{
  addedAt: string; // Timestamp when the record was added
  additionalInfo: string; // Optional additional information
  address: string; // Address of the location
  lat: number; // Latitude of the location
  lng: number; // Longitude of the location
  reported: number; // Count of how many times the address was reported
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
   - For local development, use Firebase CLI authentication:
     ```bash
     firebase login
     ```
   - Or set up a service account key and set `GOOGLE_APPLICATION_CREDENTIALS` in `.env`.

## Usage

⚠️ **Important**: This script will **replace all existing data** in both databases. Make sure to back up your data first!

### Run the migration:

```bash
npm run migrate migrateDBs
```

### Recalculate statistics:

```bash
npm run migrate recalculateStats
```

### Delete pins from a specific date onwards:

```bash
npm run migrate deleteAfter <date>
```

**Examples:**

```bash
# Delete all pins from October 25, 2024 onwards
npm run migrate deleteAfter 2024-10-25

# Delete all pins from a specific timestamp onwards
npm run migrate deleteAfter 2024-10-25T12:30:00.000Z

# Delete all pins from today onwards
npm run migrate deleteAfter $(date -u +"%Y-%m-%d")
```

### Alternative usage:

Run the script directly with Node.js:

```bash
node migrations.js migrateDBs
node migrations.js recalculateStats
node migrations.js deleteAfter 2024-10-25
```

## What the script does:

### Migration (`migrateDBs`):

1. **Reads data** from both Realtime Database and Firestore.
2. **Processes each record** to create consistent address keys using `makeAddressKey()`.
3. **Consolidates duplicates** by counting how many times each address appears.
4. **Merges data** from both databases, combining report counts for addresses that appear in both.
5. **Writes the consolidated data** back to both databases with new keys and report counts.

### Statistics Recalculation (`recalculateStats`):

1. **Aggregates statistics** for total pins, today's pins, and weekly pins.
2. **Sums up `reported` counts** from both databases, defaulting to 1 if missing.
3. **Updates the calculated statistics** in the Realtime Database.

### Pin Deletion (`deleteAfter <date>`):

1. **Scans both databases** for pins with `addedAt` date >= the specified date.
2. **Counts and displays** the total number of pins to be deleted.
3. **Prompts for confirmation** before proceeding with deletion.
4. **Deletes pins** from both databases if confirmed by user.
5. **Supports ISO 8601 date formats** including date-only (`2024-10-25`) and full timestamps (`2024-10-25T12:30:00.000Z`).

**⚠️ Warning**: The `deleteAfter` command permanently deletes data. Always backup your data before using this command.

## Example Output

### Migration Summary:

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

### Statistics Recalculation Summary:

```
📊 Starting stats recalculation...
=====================================
✅ Total pins: 200
✅ Today's pins: 15
✅ Weekly pins: 50
🎉 Stats recalculation completed successfully!
=====================================
```

### Pin Deletion Summary:

```
🗑️  Starting deletion of pins from 2024-10-25 onwards...
=====================================
🗑️  Scanning for pins to delete from 2024-10-25 onwards...

📊 Pins found to delete:
   Realtime Database: 15 pins
   Firestore: 8 pins
   Total: 23 pins
   Date threshold: 2024-10-25T00:00:00.000Z

❓ Delete 23 pins? [y/n]: y

🔄 Deleting 15 pins from Realtime Database...
🔄 Deleting 8 pins from Firestore...

✅ Successfully deleted 23 pins:
   Realtime Database: 15 pins deleted
   Firestore: 8 pins deleted
🎉 Deletion process completed!
=====================================
```

## Configuration

You can adjust the following in the script:

- **Database paths**: Modify the `ref` path in `migrateRealtimeDatabase()`.
- **Collection names**: Change the collection name in `migrateFirestore()`.
- **Data validation**: Add custom validation logic for your specific data requirements.
- **Confirmation step**: Comment out the confirmation logic for automated execution.

## Safety Features

- **Dry run capability**: The script shows a summary before writing data.
- **Detailed logging**: See exactly what's being processed and consolidated.
- **Error handling**: Proper error handling and cleanup.
- **Data validation**: Skips records with missing or invalid addresses.
