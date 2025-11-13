# Ice Tracker Firebase Functions

This document provides detailed documentation for the Firebase Cloud Functions used in the Ice Tracker application.

## Table of Contents

- [Overview](#overview)
- [Pin Function](#pin-function)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)

## Overview

The Ice Tracker Firebase Functions handle backend operations for the Ice Tracker application, including location reporting, data validation, geocoding, and database management.

## Pin Function

The `pin` function is the core Firebase Cloud Function responsible for processing location reports submitted by users.

### Function Signature

```typescript
export const pin = onCall(async (request) => { ... })
```

### Description

This function accepts location data, validates and sanitizes the input, geocodes the address to get precise coordinates, and stores the location in Firebase Realtime Database under the `/pending` collection.

### Input Parameters

The function expects a `request` object with the following `data` properties:

| Parameter        | Type     | Required | Description                                                                  |
| ---------------- | -------- | -------- | ---------------------------------------------------------------------------- |
| `addedAt`        | `string` | ✅       | ISO 8601 timestamp when the location was added (must be today's date in UTC) |
| `address`        | `string` | ✅       | The physical address to be pinned                                            |
| `additionalInfo` | `string` | ✅       | Additional information about the location (now required)                     |
| `imageUrl`       | `string` | ✅       | Download URL of the image associated with the location                       |
| `imagePath`      | `string` | ✅       | Storage path of the image associated with the location                       |

#### Example Input

```javascript
{
  data: {
    addedAt: "2025-11-12T14:30:00.000Z",
    address: "123 Main Street, New York, NY",
    additionalInfo: "ICE checkpoint observed near intersection",
    imageUrl: "https://firebasestorage.googleapis.com/...",
    imagePath: "reports/pending/user123/1699872600000.jpg"
  }
}
```

### Return Value

The function returns a Promise that resolves to an object with the following structure:

| Property           | Type     | Description                                             |
| ------------------ | -------- | ------------------------------------------------------- |
| `message`          | `string` | Success confirmation message                            |
| `formattedAddress` | `string` | The geocoded and formatted address from Google Maps API |
| `reportId`         | `string` | Unique identifier for the report (address key)          |

#### Example Response

```javascript
{
  message: "Data logged and saved successfully",
  formattedAddress: "123 Main St, New York, NY 10001, USA"
}
```

### Validation Rules

#### Date Validation

- `addedAt` must be in valid ISO 8601 format
- `addedAt` must represent today's date in UTC
- Invalid dates will result in `invalid-argument` error

#### Address Validation

- Address cannot be empty after sanitization
- Address must be geocodable (found by Google Maps API)
- Generic addresses (like city names) may be rejected
- Invalid addresses will result in `not-found` error

#### Input Sanitization

- All text inputs are sanitized to prevent injection attacks
- HTML tags and potentially dangerous characters are removed
- Empty or whitespace-only inputs are rejected

### Processing Flow

1. **Input Validation**: Validates required fields and date format
2. **Input Sanitization**: Cleans address and additional info to prevent attacks
3. **Rate Limiting**: Checks IP-based daily quota (handled by caller)
4. **Geocoding**: Converts address to coordinates and formatted address
5. **Address Key Generation**: Creates sanitized key from formatted address
6. **Duplicate Check**: Checks if address already exists in `/pending`
7. **Data Storage**: Saves/updates location data in Firebase Realtime Database
8. **Response**: Returns success message and formatted address

### Database Operations

#### Storage Location

- All reports are stored in Firebase Realtime Database under `/pending/{addressKey}`
- Address key is generated from the geocoded formatted address

#### Data Structure

Each location entry contains:

```typescript
interface PinLocation {
  addedAt: string; // ISO 8601 timestamp
  address: string; // Formatted address from geocoding
  additionalInfo: string; // Sanitized additional information
  lat: number; // Latitude from geocoding
  lng: number; // Longitude from geocoding
  reported: number; // Number of reports for this address
  imageUrl: string; // Download URL for associated image
  imagePath: string; // Storage path for associated image
}
```

#### Duplicate Handling

- If an address already exists, the `reported` count is incremented
- Existing location data is updated with new information
- New locations start with `reported: 1`

### Error Handling

The function throws `HttpsError` with specific error codes:

| Error Code         | Condition                     | Message                                                                     |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------- |
| `invalid-argument` | Missing required fields       | "Missing required fields: addedAt and address"                              |
| `invalid-argument` | Invalid date format           | "Invalid date format for addedAt. Must be ISO 8601 format."                 |
| `invalid-argument` | Date not today                | "Invalid date format for addedAt. Must be today's date in ISO 8601 format." |
| `invalid-argument` | Empty address                 | "Invalid address provided"                                                  |
| `invalid-argument` | Address key generation failed | "Could not generate valid address key"                                      |
| `not-found`        | Address not geocodable        | "Please provide a valid address that can be found on the map"               |
| `internal`         | Database operation failed     | "Internal server error"                                                     |

### Updates to Pin Function

#### Recent Changes

- **Additional Info Validation**: The `additionalInfo` field is now required and sanitized to prevent injection attacks. Empty or missing `additionalInfo` will result in an `invalid-argument` error.
- **Improved Error Handling**: Enhanced logging for database operations and geocoding failures.
- **Duplicate Handling**: Updated logic to increment the `reported` count for existing addresses while preserving new data.

#### Example Input (Updated)

```javascript
{
  data: {
    addedAt: "2025-11-12T14:30:00.000Z",
    address: "123 Main Street, New York, NY",
    additionalInfo: "ICE checkpoint observed near intersection",
    imageUrl: "https://firebasestorage.googleapis.com/...",
    imagePath: "reports/pending/user123/1699872600000.jpg"
  }
}
```

#### Example Response (Updated)

```javascript
{
  message: "Data logged and saved successfully",
  formattedAddress: "123 Main St, New York, NY 10001, USA"
}
```

#### Validation Rules (Updated)

- `additionalInfo` is now required and sanitized.
- Enhanced error messages for geocoding and database failures.

### Dependencies

The function relies on several external services and utilities:

- **Google Geocoding Service**: For address validation and coordinate conversion
- **Firebase Realtime Database**: For data storage
- **Input Sanitization**: For security and data cleaning
- **Address Key Generation**: For creating consistent database keys

## Database Schema

### Realtime Database Structure

```
/pending/
  /{addressKey}/
    addedAt: "2025-11-12T14:30:00.000Z"
    address: "123 Main St, New York, NY 10001, USA"
    additionalInfo: "ICE checkpoint observed"
    lat: 40.7128
    lng: -74.0060
    reported: 1
    imageUrl: "https://..."
    imagePath: "reports/pending/..."
```

### Address Key Format

Address keys are generated by:

1. Taking the formatted address from geocoding
2. Converting to lowercase
3. Replacing spaces and special characters with hyphens
4. Removing consecutive hyphens

Example: `"123 Main St, New York, NY"` → `"123-main-st-new-york-ny"`

## Usage Examples

### Client-Side Integration

```javascript
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase-config";

const pinFunction = httpsCallable(functions, "pin");

// Submit a report
const submitReport = async (reportData) => {
  try {
    const result = await pinFunction({
      addedAt: new Date().toISOString(),
      address: reportData.address,
      additionalInfo: reportData.info,
      imageUrl: reportData.imageUrl,
      imagePath: reportData.imagePath,
    });

    console.log("Success:", result.data);
    return result.data;
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
};
```

### Testing

The function includes comprehensive integration tests covering:

- Successful report submission
- Input validation errors
- Address geocoding failures
- Rate limiting enforcement
- Database operations
- Error handling scenarios

Run tests with:

```bash
npm run test:integration
```

## Security Considerations

1. **Input Sanitization**: All user inputs are sanitized to prevent injection attacks
2. **Rate Limiting**: IP-based daily quotas prevent spam and abuse
3. **Date Validation**: Only today's reports are accepted to prevent backdating
4. **Address Validation**: Geocoding ensures addresses are legitimate locations
5. **Error Handling**: Generic error messages prevent information leakage

## Performance Considerations

1. **Geocoding Caching**: Consider implementing caching for frequently requested addresses
2. **Database Indexing**: Address keys provide efficient lookups
3. **Batch Operations**: Multiple operations are batched when possible
4. **Error Recovery**: Robust error handling prevents partial state issues
