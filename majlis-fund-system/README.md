# Majlis Session Fund System

A single-user web application for managing a monthly Majlis fund with deterministic accounting, strong auditability, and immutable history.

## Features

- **Dashboard**: Real-time overview of treasury balance, cash flow, and member balances
- **Member Management**: Track active members, handle member departures with debt tracking
- **Payment Recording**: Support for cash and bank transfers with FIFO application
- **Expense Tracking**: Treasury-paid and member-paid expenses with recurring expense support
- **Adjustments**: Immutable corrections via adjustment entries (no in-place edits)
- **Settlements**: Reimbursement tracking for member credits
- **Reports**: Excel (.xlsx) and PDF export for any cycle range
- **Audit Trail**: Complete audit log of all changes

## System Requirements

- Google Account (admin access)
- Google Sheets
- Google Apps Script

## Currency & Locale

- Currency: SAR (Saudi Riyal) only
- Timezone: Asia/Riyadh (all dates and times)
- Language: English only

---

## Setup Instructions

### Step 1: Create the Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Rename it to "Majlis Fund System" (or your preferred name)
4. Copy the **Spreadsheet ID** from the URL:
   - URL format: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - The ID is the long string between `/d/` and `/edit`

### Step 2: Create the Apps Script Project

1. In your new spreadsheet, go to **Extensions** > **Apps Script**
2. This opens the Apps Script editor
3. Delete any default code in `Code.gs`

### Step 3: Add Backend Files

Create the following files in the Apps Script editor (click the `+` next to Files and select "Script"):

**Code.gs** - Copy the contents from `backend/Code.gs`

**SchemaInit.gs** - Copy the contents from `backend/SchemaInit.gs`

**CycleEngine.gs** - Copy the contents from `backend/CycleEngine.gs`

**Members.gs** - Copy the contents from `backend/Members.gs`

**LedgerEngine.gs** - Copy the contents from `backend/LedgerEngine.gs`

**Transactions.gs** - Copy the contents from `backend/Transactions.gs`

**Settings.gs** - Copy the contents from `backend/Settings.gs`

### Step 4: Add Frontend Files

Create the following files (click the `+` next to Files and select "HTML"):

**Index.html** - Copy the contents from `frontend/Index.html`

**Styles.html** - Copy the contents from `frontend/Styles.html`

**App.html** - Copy the contents from `frontend/App.html`

### Step 5: Configure the Spreadsheet ID

1. Open `Code.gs`
2. Find the `CONFIG` object at the top
3. Set `SPREADSHEET_ID` to your spreadsheet ID from Step 1:

```javascript
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',  // <-- Update this
  // ... rest of config
};
```

### Step 6: Set Project Timezone

1. In the Apps Script editor, click the gear icon (Project Settings)
2. Under "Time zone", select **Asia/Riyadh (GMT+3)**
3. Click **Save**

### Step 7: Deploy as Web App

1. Click **Deploy** > **New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: "Majlis Fund System v1.0"
   - **Execute as**: "Me" (your account)
   - **Who has access**: "Only myself" (single-user access)
4. Click **Deploy**
5. Authorize the app when prompted (review and allow permissions)
6. Copy the **Web app URL** - this is your application URL

### Step 8: Initialize the System

1. Open the Web app URL in your browser
2. You may see a loading screen
3. If the system hasn't been initialized, go to **Settings** tab
4. Click **Initialize / Repair System**
5. This creates all required sheets and default data

### Step 9: Verify Setup

1. Go back to your Google Spreadsheet
2. You should see new sheets created:
   - Settings, Cycles, Members, Dues, Payments, Expenses
   - Recurring_Expenses, Adjustments, Settlements
   - Banks, Categories, Audit_Log

3. Return to the Web App and verify:
   - Dashboard shows current cycle
   - Settings shows correct system information

---

## Usage Guide

### Dashboard

The dashboard provides:
- **Treasury Cash Balance**: Current cash in the fund
- **Net Cash Flow**: Inflows minus outflows for the period
- **Total Outstanding**: Sum of all member debts
- **Member Credits**: Sum of all credits owed to members
- **Alerts**: Warnings for negative cash, overdue members, etc.
- **Member Balances Table**: Quick overview of each member
- **Recent Transactions**: Latest payments and expenses

### Members

- **Add Member**: Create new member with start cycle
- **View Ledger**: See complete transaction history
- **Mark Left**: Handle member departure (tracks open debt)
- Status types:
  - `Active`: Currently participating
  - `LeftOpenDebt`: Left with outstanding balance
  - `Closed`: Fully settled and inactive

### Payments

- Record payments with Cash or Bank Transfer method
- Payments are automatically applied via FIFO to oldest dues first
- Overpayments create credits for future cycles

### Expenses

- **Treasury**: Decreases treasury cash
- **Member**: Creates credit for the paying member
- **Planned**: Auto-generated from recurring expenses
- **Recurring**: Setup for automatic planned items each cycle

### Adjustments

Use adjustments for corrections (never edit original records):
- Positive amount: Increases debt/expense
- Negative amount: Creates credit/reduction
- Always requires a reason for audit trail

### Settlements

Record when treasury cash is paid to members with credit.

### Reports

- Select date range by cycle
- Export to Excel (.xlsx) or PDF
- Includes all transactions and member summaries

---

## Cycle Model

### Cycle Definition

- Each cycle runs from **day 27** to **day 26** (inclusive)
- Named by the **ending month**:
  - "September 2025" = Aug 27, 2025 → Sep 26, 2025
  - "December 2025" = Nov 27, 2025 → Dec 26, 2025

### System Start

- First cycle: **September 2025**
- Earliest allowed date: **2025-08-27**

### Auto-Close (Self-Healing)

On each app load:
1. System checks if cycles are missing or unclosed
2. Automatically closes past cycles
3. Opens new cycles as needed
4. Generates dues and planned expenses
5. No manual intervention required

### Manual Close

A fallback button is available in Settings if automation fails.

---

## Accounting Conventions

### Effective Balance (Member)

- **Positive**: Member owes the group
- **Negative**: Group owes member (credit)

### Treasury Cash

- Increases: Member payments
- Decreases: Treasury-paid expenses, settlements
- Member-paid expenses do NOT affect treasury (create credit instead)

### Opening Balance

- System starts with 3000 SAR treasury cash
- Recorded as an adjustment entry

### FIFO Application

Payments are applied to the oldest unpaid dues first.

---

## Immutability Rules

1. **No in-place edits** for financial records
2. **Corrections via Adjustments** only
3. **Closed cycles are read-only**
4. **Audit log is append-only**

---

## Upgrades & Migrations

When schema version changes:

1. Check `SCHEMA.md` for migration notes
2. Update `CONFIG.SCHEMA_VERSION` in Code.gs
3. Add migration logic to `SchemaInit.gs`
4. Re-deploy the web app
5. Run **Initialize / Repair System** in Settings

---

## Troubleshooting

### "SPREADSHEET_ID not configured"
Update the `CONFIG.SPREADSHEET_ID` in Code.gs with your sheet ID.

### "Sheet not found"
Run **Initialize / Repair System** from Settings tab.

### "LOCK_TIMEOUT"
Wait a moment and try again. The system uses locking to prevent concurrent writes.

### "CYCLE_CLOSED"
Cannot modify records in closed cycles. Use Adjustments instead.

### Blank screen on load
1. Check browser console for errors
2. Verify all files are saved in Apps Script
3. Re-deploy the web app

---

## File Structure

```
majlis-fund-system/
├── backend/
│   ├── Code.gs           # Main entry point, router
│   ├── SchemaInit.gs     # Database initialization
│   ├── CycleEngine.gs    # Cycle management, auto-close
│   ├── Members.gs        # Member operations
│   ├── LedgerEngine.gs   # FIFO calculations, balances
│   ├── Transactions.gs   # Payments, expenses, etc.
│   └── Settings.gs       # Settings, banks, categories
├── frontend/
│   ├── Index.html        # Main HTML template
│   ├── Styles.html       # CSS styles
│   └── App.html          # JavaScript application
├── SCHEMA.md             # Database schema documentation
├── API_CONTRACT.md       # API endpoints documentation
└── README.md             # This file
```

---

## Support

This is a single-user administrative system. For issues:
1. Check the Audit_Log sheet for error details
2. Review browser console for JavaScript errors
3. Verify Apps Script execution logs

---

## License

Internal use only. All rights reserved.
