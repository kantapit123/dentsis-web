# Mock API Data

This directory contains mock JSON data for development and testing purposes.

## Files

- `appointments-today.json` - Sample appointments data for today
- `patients.json` - Sample patients data

## Usage

### Option 1: Use Mock API Utility

The `src/utils/mockApi.ts` utility provides an easy way to use mock data:

```typescript
import { apiFetch } from '../utils/mockApi';

// This will use mock data if enabled, otherwise use real API
const response = await apiFetch('/api/v1/appointments/today');
```

**Enable/Disable Mock API:**

```typescript
import { enableMockApi, disableMockApi } from '../utils/mockApi';

// Enable mock API (stores in localStorage)
enableMockApi();

// Disable mock API
disableMockApi();
```

Or set in browser console:
```javascript
localStorage.setItem('USE_MOCK_API', 'true'); // Enable
localStorage.removeItem('USE_MOCK_API'); // Disable
```

### Option 2: Direct Import

You can also import the JSON files directly:

```typescript
import appointmentsMock from '../mocks/appointments-today.json';
import patientsMock from '../mocks/patients.json';
```

### Option 3: Environment Variable

Set `VITE_USE_MOCK_API=true` in your `.env` file to automatically use mock data.

## Mock Data Structure

### Appointments (`appointments-today.json`)

```typescript
{
  "data": [
    {
      "id": "apt-001",
      "patientName": "สมชาย ใจดี",
      "dentistName": "Dr. Sarah Johnson",
      "startTime": "2024-01-15T09:00:00Z",
      "endTime": "2024-01-15T09:30:00Z",
      "status": "BOOKED",
      "chairNumber": 1
    }
  ]
}
```

### Patients (`patients.json`)

```typescript
{
  "data": [...],
  "page": 1,
  "totalPages": 1,
  "total": 10
}
```

## Notes

- Mock data includes Thai names for realistic testing
- Appointments cover all status types: BOOKED, ARRIVED, IN_TREATMENT, DONE, NO_SHOW, CANCELLED
- Some appointments have `chairNumber: null` to test optional fields
- The mock API utility simulates network delay (200-500ms)

