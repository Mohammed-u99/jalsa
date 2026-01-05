# Majlis Fund System - API Contract

## Base URL
`https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

## Authentication
- Web App restricted to admin Google account
- Optional: `Authorization: Bearer {ADMIN_TOKEN}` header

## Request Format
All POST requests use JSON body with `action` field:
```json
{
  "action": "actionName",
  "data": { ... }
}
```

## Response Format
```json
{
  "success": true|false,
  "data": { ... },
  "error": "Error message if success=false",
  "timestamp": "ISO DateTime"
}
```

---

## 1. Settings Endpoints

### GET /settings
**Request:** `GET ?action=getSettings`

**Response:**
```json
{
  "success": true,
  "data": {
    "schemaVersion": "1.0.0",
    "openingTreasuryCash": 3000,
    "defaultDueAmount": 150,
    "systemStartCycle": "2025-09",
    "earliestAllowedDate": "2025-08-27",
    "timezone": "Asia/Riyadh"
  }
}
```

### POST updateSetting
**Request:**
```json
{
  "action": "updateSetting",
  "data": {
    "key": "defaultDueAmount",
    "value": "150"
  }
}
```

---

## 2. Cycles Endpoints

### GET /cycles
**Request:** `GET ?action=getCycles`

**Response:**
```json
{
  "success": true,
  "data": {
    "cycles": [
      {
        "cycleId": "uuid",
        "cycleKey": "2025-09",
        "cycleName": "September 2025",
        "startDate": "2025-08-27",
        "endDate": "2025-09-26",
        "status": "Closed",
        "dueAmountOverride": null,
        "closedAt": "2025-09-27T00:00:00+03:00",
        "paymentStatusSnapshot": {"member1": "Paid", "member2": "PartiallyPaid"}
      }
    ],
    "currentCycle": {
      "cycleKey": "2026-01",
      "cycleName": "January 2026",
      "status": "Open"
    }
  }
}
```

### POST ensureCyclesCurrent
Runs self-healing loop to ensure cycles are up-to-date.
```json
{
  "action": "ensureCyclesCurrent"
}
```

### POST closeCycle (manual fallback)
```json
{
  "action": "closeCycle",
  "data": {
    "cycleKey": "2025-12"
  }
}
```

### POST setCycleOverride
```json
{
  "action": "setCycleOverride",
  "data": {
    "cycleKey": "2026-02",
    "dueAmountOverride": 200
  }
}
```

---

## 3. Members Endpoints

### GET /members
**Request:** `GET ?action=getMembers`

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "memberId": "uuid",
        "displayName": "Ahmed",
        "startCycle": "2025-09",
        "endCycle": null,
        "status": "Active",
        "phone": "+966...",
        "email": "...",
        "notes": "",
        "effectiveBalance": 150.00,
        "pendingCredit": 0,
        "activeCredit": 0
      }
    ]
  }
}
```

### POST createMember
```json
{
  "action": "createMember",
  "data": {
    "displayName": "Mohammed",
    "startCycle": "2025-09",
    "phone": "+966...",
    "email": "...",
    "notes": ""
  }
}
```

**Validation:**
- `displayName` must be unique (case-insensitive)
- `startCycle` must be >= system start cycle

### POST updateMember
```json
{
  "action": "updateMember",
  "data": {
    "memberId": "uuid",
    "phone": "+966...",
    "email": "...",
    "notes": "..."
  }
}
```

### POST markMemberLeft
```json
{
  "action": "markMemberLeft",
  "data": {
    "memberId": "uuid",
    "endCycle": "2025-12"
  }
}
```

---

## 4. Dues Endpoints

### GET /dues
**Request:** `GET ?action=getDues&cycleKey=2025-09` or `GET ?action=getDues`

**Response:**
```json
{
  "success": true,
  "data": {
    "dues": [
      {
        "dueId": "uuid",
        "memberId": "uuid",
        "memberName": "Ahmed",
        "cycleKey": "2025-09",
        "cycleName": "September 2025",
        "amount": 150.00,
        "generatedAt": "2025-08-27T00:00:00+03:00"
      }
    ]
  }
}
```

---

## 5. Payments Endpoints

### GET /payments
**Request:** `GET ?action=getPayments&cycleKey=2025-09` or full list

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "paymentId": "uuid",
        "memberId": "uuid",
        "memberName": "Ahmed",
        "operationDate": "2025-09-15",
        "cycleKey": "2025-09",
        "cycleName": "September 2025",
        "amount": 150.00,
        "method": "Cash",
        "bankName": null,
        "transferNote": null,
        "notes": ""
      }
    ]
  }
}
```

### POST createPayment
```json
{
  "action": "createPayment",
  "data": {
    "memberId": "uuid",
    "operationDate": "2025-09-15",
    "amount": 150.00,
    "method": "Cash",
    "bankName": null,
    "transferNote": null,
    "notes": ""
  }
}
```

**Validation:**
- `operationDate` must fall within an Open cycle
- `operationDate` >= 2025-08-27
- `amount` > 0, 2 decimals max

---

## 6. Expenses Endpoints

### GET /expenses
**Request:** `GET ?action=getExpenses&cycleKey=2025-09`

**Response:**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "expenseId": "uuid",
        "operationDate": "2025-09-01",
        "cycleKey": "2025-09",
        "cycleName": "September 2025",
        "category": "Rent",
        "description": "Monthly rent",
        "amount": 500.00,
        "paidBy": "Treasury",
        "paidByMemberId": null,
        "paidByMemberName": null,
        "recurringExpenseId": null,
        "isPlanned": false,
        "notes": ""
      }
    ]
  }
}
```

### POST createExpense
```json
{
  "action": "createExpense",
  "data": {
    "operationDate": "2025-09-01",
    "category": "Rent",
    "description": "Monthly rent",
    "amount": 500.00,
    "paidBy": "Treasury",
    "paidByMemberId": null,
    "notes": ""
  }
}
```

### POST markPlannedExpensePaid
```json
{
  "action": "markPlannedExpensePaid",
  "data": {
    "expenseId": "uuid",
    "operationDate": "2025-09-01",
    "amount": 500.00,
    "paidBy": "Treasury",
    "paidByMemberId": null
  }
}
```

---

## 7. Recurring Expenses Endpoints

### GET /recurringExpenses
**Request:** `GET ?action=getRecurringExpenses`

**Response:**
```json
{
  "success": true,
  "data": {
    "recurringExpenses": [
      {
        "recurringExpenseId": "uuid",
        "category": "Rent",
        "description": "Monthly rent",
        "type": "Fixed",
        "defaultAmount": 500.00,
        "isActive": true
      }
    ]
  }
}
```

### POST createRecurringExpense
```json
{
  "action": "createRecurringExpense",
  "data": {
    "category": "Rent",
    "description": "Monthly rent",
    "type": "Fixed",
    "defaultAmount": 500.00
  }
}
```

---

## 8. Adjustments Endpoints

### GET /adjustments
**Request:** `GET ?action=getAdjustments&cycleKey=2025-09`

**Response:**
```json
{
  "success": true,
  "data": {
    "adjustments": [
      {
        "adjustmentId": "uuid",
        "operationDate": "2025-09-20",
        "cycleKey": "2025-09",
        "cycleName": "September 2025",
        "entityType": "Payment",
        "entityId": "uuid",
        "memberId": "uuid",
        "memberName": "Ahmed",
        "amount": -50.00,
        "reason": "Payment recorded incorrectly",
        "notes": ""
      }
    ]
  }
}
```

### POST createAdjustment
```json
{
  "action": "createAdjustment",
  "data": {
    "operationDate": "2025-09-20",
    "entityType": "Payment",
    "entityId": "uuid",
    "memberId": "uuid",
    "amount": -50.00,
    "reason": "Payment recorded incorrectly",
    "notes": ""
  }
}
```

---

## 9. Settlements Endpoints

### GET /settlements
**Request:** `GET ?action=getSettlements`

**Response:**
```json
{
  "success": true,
  "data": {
    "settlements": [
      {
        "settlementId": "uuid",
        "memberId": "uuid",
        "memberName": "Ahmed",
        "operationDate": "2025-09-25",
        "cycleKey": "2025-09",
        "cycleName": "September 2025",
        "amount": 100.00,
        "method": "Cash",
        "notes": ""
      }
    ]
  }
}
```

### POST createSettlement
```json
{
  "action": "createSettlement",
  "data": {
    "memberId": "uuid",
    "operationDate": "2025-09-25",
    "amount": 100.00,
    "notes": ""
  }
}
```

---

## 10. Banks Endpoints

### GET /banks
**Request:** `GET ?action=getBanks`

### POST createBank
```json
{
  "action": "createBank",
  "data": {
    "bankName": "NewBank"
  }
}
```

---

## 11. Categories Endpoints

### GET /categories
**Request:** `GET ?action=getCategories`

### POST createCategory
```json
{
  "action": "createCategory",
  "data": {
    "categoryName": "Internet"
  }
}
```

---

## 12. Audit Endpoints

### GET /audit
**Request:** `GET ?action=getAuditLog&entityType=Payment&entityId=uuid`

---

## 13. Snapshot Endpoint (Dashboard/Reports)

### GET /snapshot
**Request:** `GET ?action=getSnapshot&startCycle=2025-09&endCycle=2026-01`

**Response:**
```json
{
  "success": true,
  "data": {
    "cycles": [...],
    "members": [...],
    "dues": [...],
    "payments": [...],
    "expenses": [...],
    "adjustments": [...],
    "settlements": [...],
    "summary": {
      "treasuryCashBalance": 2500.00,
      "netCashFlow": -500.00,
      "totalExpenses": 1000.00,
      "treasuryCashExpenses": 800.00,
      "totalOutstanding": 450.00,
      "totalCredits": 100.00,
      "pendingCredits": 50.00
    },
    "memberBalances": [
      {
        "memberId": "uuid",
        "displayName": "Ahmed",
        "totalDues": 600.00,
        "totalPayments": 450.00,
        "activeCredit": 0,
        "pendingCredit": 0,
        "adjustments": 0,
        "settlements": 0,
        "effectiveBalance": 150.00
      }
    ],
    "alerts": {
      "negativeCash": false,
      "overdueMembers": ["uuid1"],
      "leftOpenDebtMembers": [],
      "unpaidPlannedItems": ["uuid2"],
      "pendingSettlements": []
    }
  }
}
```

---

## 14. Member Ledger Endpoint

### GET /memberLedger
**Request:** `GET ?action=getMemberLedger&memberId=uuid`

**Response:**
```json
{
  "success": true,
  "data": {
    "member": {...},
    "ledger": [
      {
        "date": "2025-08-27",
        "type": "Due",
        "description": "September 2025 due",
        "debit": 150.00,
        "credit": 0,
        "balance": 150.00
      },
      {
        "date": "2025-09-15",
        "type": "Payment",
        "description": "Cash payment",
        "debit": 0,
        "credit": 150.00,
        "balance": 0
      }
    ],
    "currentBalance": 0
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| INVALID_DATE | Date outside allowed range or closed cycle |
| DUPLICATE_NAME | Member displayName already exists |
| CYCLE_CLOSED | Cannot modify records in closed cycle |
| INVALID_AMOUNT | Amount must be positive with max 2 decimals |
| NOT_FOUND | Entity not found |
| VALIDATION_ERROR | General validation failure |
| LOCK_TIMEOUT | Could not acquire write lock |
