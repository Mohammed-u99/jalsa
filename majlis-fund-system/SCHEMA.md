# Majlis Fund System - Google Sheets Schema

## Schema Version: 1.0.0

All sheets include `schemaVersion` column (currently "1.0.0").

---

## 1. Settings Sheet

| Column | Type | Description |
|--------|------|-------------|
| key | String | Setting key |
| value | String | Setting value |
| schemaVersion | String | "1.0.0" |
| updatedAt | ISO DateTime | Last update timestamp |
| updatedBy | String | Admin email |

**Default Settings:**
- `schemaVersion`: "1.0.0"
- `openingTreasuryCash`: "3000"
- `defaultDueAmount`: "150"
- `systemStartCycle`: "2025-09"
- `earliestAllowedDate`: "2025-08-27"
- `timezone`: "Asia/Riyadh"
- `adminToken`: (optional shared secret)

---

## 2. Cycles Sheet

| Column | Type | Description |
|--------|------|-------------|
| cycleId | UUID | Primary key |
| cycleKey | String | "YYYY-MM" (ending month) |
| cycleName | String | "Month YYYY" (e.g., "September 2025") |
| startDate | Date | YYYY-MM-DD (day 27 of previous month) |
| endDate | Date | YYYY-MM-DD (day 26 of this month) |
| status | Enum | Open, Closed |
| dueAmountOverride | Number | Null or override amount |
| closedAt | ISO DateTime | When cycle was closed |
| paymentStatusSnapshot | JSON | {"memberId": "Paid|PartiallyPaid|Unpaid", ...} |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| updatedAt | ISO DateTime | |

---

## 3. Members Sheet

| Column | Type | Description |
|--------|------|-------------|
| memberId | UUID | Primary key |
| displayName | String | Unique name |
| startCycle | String | "YYYY-MM" when member joined |
| endCycle | String | "YYYY-MM" or null if still active |
| status | Enum | Active, LeftOpenDebt, Closed |
| phone | String | Optional |
| email | String | Optional |
| notes | String | Optional |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| createdBy | String | Admin email |
| updatedAt | ISO DateTime | |
| updatedBy | String | Admin email |

---

## 4. Dues Sheet

| Column | Type | Description |
|--------|------|-------------|
| dueId | UUID | Primary key |
| memberId | UUID | FK to Members |
| cycleKey | String | "YYYY-MM" |
| amount | Number | Due amount (2 decimals) |
| generatedAt | ISO DateTime | When due was generated |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |

---

## 5. Payments Sheet

| Column | Type | Description |
|--------|------|-------------|
| paymentId | UUID | Primary key |
| memberId | UUID | FK to Members |
| operationDate | Date | YYYY-MM-DD (date of real-world payment) |
| cycleKey | String | "YYYY-MM" (derived from operationDate) |
| amount | Number | Positive, 2 decimals |
| method | Enum | Cash, BankTransfer |
| bankName | String | If method=BankTransfer |
| transferNote | String | Optional |
| notes | String | Optional |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| createdBy | String | Admin email |
| updatedAt | ISO DateTime | |
| updatedBy | String | Admin email |

---

## 6. Expenses Sheet

| Column | Type | Description |
|--------|------|-------------|
| expenseId | UUID | Primary key |
| operationDate | Date | YYYY-MM-DD |
| cycleKey | String | "YYYY-MM" (derived from operationDate) |
| category | String | FK to Categories |
| description | String | |
| amount | Number | Positive, 2 decimals |
| paidBy | Enum | Treasury, Member |
| paidByMemberId | UUID | If paidBy=Member |
| recurringExpenseId | UUID | If from recurring item |
| isPlanned | Boolean | True if planned, not yet paid |
| notes | String | Optional |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| createdBy | String | Admin email |
| updatedAt | ISO DateTime | |
| updatedBy | String | Admin email |

---

## 7. Recurring_Expenses Sheet

| Column | Type | Description |
|--------|------|-------------|
| recurringExpenseId | UUID | Primary key |
| category | String | FK to Categories |
| description | String | |
| type | Enum | Fixed, Variable |
| defaultAmount | Number | For Fixed type; null for Variable |
| isActive | Boolean | |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| createdBy | String | Admin email |
| updatedAt | ISO DateTime | |
| updatedBy | String | Admin email |

---

## 8. Adjustments Sheet

| Column | Type | Description |
|--------|------|-------------|
| adjustmentId | UUID | Primary key |
| operationDate | Date | YYYY-MM-DD |
| cycleKey | String | "YYYY-MM" (derived from operationDate) |
| entityType | Enum | Payment, Expense, Due, Settlement, OpeningBalance, Other |
| entityId | UUID | Reference to original record |
| memberId | UUID | Optional |
| amount | Number | Positive or negative (2 decimals) |
| reason | String | Required |
| notes | String | Optional |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| createdBy | String | Admin email |

---

## 9. Settlements Sheet

| Column | Type | Description |
|--------|------|-------------|
| settlementId | UUID | Primary key |
| memberId | UUID | FK to Members |
| operationDate | Date | YYYY-MM-DD |
| cycleKey | String | "YYYY-MM" (derived from operationDate) |
| amount | Number | Positive (treasury paid to member) |
| method | Enum | Cash |
| notes | String | Optional |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |
| createdBy | String | Admin email |

---

## 10. Banks Sheet

| Column | Type | Description |
|--------|------|-------------|
| bankId | UUID | Primary key |
| bankName | String | Unique |
| isActive | Boolean | |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |

**Default Banks:**
- AlAhli, Riyad, STC, D360, Barq, Tickmo

---

## 11. Categories Sheet

| Column | Type | Description |
|--------|------|-------------|
| categoryId | UUID | Primary key |
| categoryName | String | Unique |
| isActive | Boolean | |
| schemaVersion | String | "1.0.0" |
| createdAt | ISO DateTime | |

**Default Categories:**
- Rent, Electricity, Water, Cleaning

---

## 12. Audit_Log Sheet (Append-Only)

| Column | Type | Description |
|--------|------|-------------|
| logId | UUID | Primary key |
| timestamp | ISO DateTime | |
| userEmail | String | |
| action | String | CREATE, UPDATE, DELETE, CLOSE_CYCLE, etc. |
| entityType | String | Member, Payment, Expense, etc. |
| entityId | UUID | |
| beforeState | JSON | Before change |
| afterState | JSON | After change |
| metadata | JSON | Additional context |

---

## Cycle Key / Name Mapping

| CycleKey | CycleName | Start Date | End Date |
|----------|-----------|------------|----------|
| 2025-09 | September 2025 | 2025-08-27 | 2025-09-26 |
| 2025-10 | October 2025 | 2025-09-27 | 2025-10-26 |
| 2025-11 | November 2025 | 2025-10-27 | 2025-11-26 |
| 2025-12 | December 2025 | 2025-11-27 | 2025-12-26 |
| 2026-01 | January 2026 | 2025-12-27 | 2026-01-26 |
| ... | ... | ... | ... |
