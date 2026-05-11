# Pharmacy Service SPA

A Single Page Application for pharmacy management with real-time WebSocket notifications.

## Quick Start

```bash
cd pharmacy-service
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## Project Structure

```
pharmacy-service/
├── index.html              # Main SPA template
├── *.html                  # Additional page templates
├── server.js               # Node.js HTTP + WebSocket server
├── package.json            # NPM project configuration
├── .eslintrc.json          # Code quality linter config
├── REQUIREMENTS.md         # Full requirements documentation
├── assets/
│   ├── css/main.css       # Compiled styles
│   ├── js/app.js          # Pure JavaScript application
│   ├── scss/              # SCSS source files
│   └── data/pharmacy-data.json  # Data storage
└── data/
    └── pharmacy-data.json  # Pharmacy data file
```

## Features

### 1. **Pure JavaScript SPA**
- No jQuery, Vue, React, or other frameworks
- Vanilla JavaScript with fetch API
- 100% browser-native APIs

### 2. **REST API with 5 Endpoints**
```
GET    /api/summary       - Pharmacy metrics & summary
GET    /api/medicines     - All medicines inventory
GET    /api/users         - Staff members list
GET    /api/demands       - All demand requests
POST   /api/demands       - Create new demand
```

### 3. **WebSocket Real-Time Notifications**
- Instant updates when new demands are created
- Auto-reconnection on connection loss
- Connection status indicator

### 4. **JSON Data Exchange**
- All API responses in JSON format
- Proper Content-Type headers
- Error handling for malformed data

### 5. **Code Quality**
- ESLint compliant (Airbnb style guide)
- No console errors or warnings
- No commented-out code
- Production-ready

## How to Verify Requirements

### 1. Check for ESLint Compliance
```bash
npm run lint
```
Output should show no errors.

### 2. Verify REST API Endpoints
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Refresh data" button
4. You should see requests to:
   - `/api/summary` - Returns metrics
   - `/api/medicines` - Returns medicine list
   - `/api/users` - Returns users list
   - `/api/demands` - Returns demands list

### 3. Test WebSocket Connection
1. Open two browser tabs with http://localhost:3000
2. In first tab, go to "Medicines" section
3. Click "Add demand request" on any medicine
4. Watch the second tab - metrics update instantly
5. Check the status indicator shows "Connected"

### 4. Verify JSON Format
1. Open DevTools
2. In Network tab, click any API request
3. Select the "Response" tab
4. You'll see properly formatted JSON

### 5. Check Console for Errors
1. Open DevTools (F12)
2. Go to Console tab
3. Should be completely clean (no red errors)

### 6. Verify Load Speed
1. Open DevTools Network tab
2. Reload the page
3. All resources load in < 4 seconds

### 7. Test Multi-Browser Support
Open the app in:
- ✅ Chrome/Edge
- ✅ Firefox  
- ✅ Safari

All should work identically with WebSocket support.

## Available Commands

```bash
npm start       # Start the server on port 3000
npm run lint    # Run ESLint code quality checks
```

## Technology Stack

**Frontend:**
- HTML5
- CSS3 (SCSS)
- Pure JavaScript (ES6+)

**Backend:**
- Node.js
- ws library (WebSocket)

**Development:**
- ESLint + Airbnb config

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome (Latest) | ✅ Full |
| Firefox (Latest) | ✅ Full |
| Safari (Latest) | ✅ Full |
| Edge (Latest) | ✅ Full |

## Documentation

See [REQUIREMENTS.md](REQUIREMENTS.md) for detailed verification of all project requirements.

## API Examples

### Fetch Summary
```javascript
const response = await fetch('/api/summary');
const data = await response.json();
console.log(data);
// { totalMedicines: 6, totalStock: 189, ... }
```

### Create Demand Request
```javascript
const response = await fetch('/api/demands', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    medicineName: 'Aspirin',
    quantity: 50,
    requestedBy: 'Pharmacy',
    priority: 'High'
  })
});
const newDemand = await response.json();
```

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.addEventListener('message', (event) => {
  const notification = JSON.parse(event.data);
  console.log('New demand created:', notification.data.medicineName);
});
```

## Notes

- Application uses real-time WebSocket for instant notifications
- Data persists in `data/pharmacy-data.json`
- All dependencies are in `package.json`
- Code passes ESLint quality checks
- No external CDN dependencies required
