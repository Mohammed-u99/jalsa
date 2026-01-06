/**
 * Majlis Session Fund System - Main Entry Point
 * Version: 1.0.0
 *
 * This is the main Apps Script file that handles:
 * - Web App entry points (doGet, doPost)
 * - UI serving via HtmlService
 * - API routing
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  SPREADSHEET_ID: '', // Set this to your Google Sheet ID
  SCHEMA_VERSION: '1.0.0',
  TIMEZONE: 'Asia/Riyadh',
  DEFAULT_DUE_AMOUNT: 150,
  OPENING_TREASURY_CASH: 3000,
  SYSTEM_START_CYCLE: '2025-09',
  EARLIEST_ALLOWED_DATE: '2025-08-27',
  LOCK_TIMEOUT_MS: 30000
};

// English month names (fixed, not locale-dependent)
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ============================================================================
// WEB APP ENTRY POINTS
// ============================================================================

/**
 * Handles GET requests - serves UI or handles API calls
 */
function doGet(e) {
  const action = e.parameter.action;

  // If no action, serve the main UI
  if (!action) {
    return serveUI_();
  }

  // Handle API GET requests
  try {
    const result = handleApiRequest_(action, e.parameter, 'GET');
    return createJsonResponse_(result);
  } catch (error) {
    return createJsonResponse_({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handles POST requests - API calls only
 */
function doPost(e) {
  try {
    const requestBody = JSON.parse(e.postData.contents);
    const action = requestBody.action;
    const data = requestBody.data || {};

    const result = handleApiRequest_(action, data, 'POST');
    return createJsonResponse_(result);
  } catch (error) {
    return createJsonResponse_({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Serves the main UI HTML
 */
function serveUI_() {
  const template = HtmlService.createTemplateFromFile('Index');
  const html = template.evaluate()
    .setTitle('Majlis Fund System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

/**
 * Include helper for HTML templates
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Creates a JSON response
 */
function createJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// API ROUTER
// ============================================================================

/**
 * Routes API requests to appropriate handlers
 */
function handleApiRequest_(action, data, method) {
  // Ensure cycles are current on every request
  if (action !== 'ensureCyclesCurrent') {
    ensureCyclesCurrentInternal_();
  }

  const timestamp = new Date().toISOString();

  switch (action) {
    // Settings
    case 'getSettings':
      return { success: true, data: getSettings_(), timestamp };
    case 'updateSetting':
      return { success: true, data: updateSetting_(data), timestamp };

    // Cycles
    case 'getCycles':
      return { success: true, data: getCycles_(), timestamp };
    case 'ensureCyclesCurrent':
      return { success: true, data: ensureCyclesCurrent_(), timestamp };
    case 'closeCycle':
      return { success: true, data: closeCycleManual_(data.cycleKey), timestamp };
    case 'setCycleOverride':
      return { success: true, data: setCycleOverride_(data.cycleKey, data.dueAmountOverride), timestamp };

    // Members
    case 'getMembers':
      return { success: true, data: getMembers_(), timestamp };
    case 'createMember':
      return { success: true, data: createMember_(data), timestamp };
    case 'updateMember':
      return { success: true, data: updateMember_(data), timestamp };
    case 'markMemberLeft':
      return { success: true, data: markMemberLeft_(data), timestamp };

    // Dues
    case 'getDues':
      return { success: true, data: getDues_(data.cycleKey), timestamp };

    // Payments
    case 'getPayments':
      return { success: true, data: getPayments_(data.cycleKey), timestamp };
    case 'createPayment':
      return { success: true, data: createPayment_(data), timestamp };

    // Expenses
    case 'getExpenses':
      return { success: true, data: getExpenses_(data.cycleKey), timestamp };
    case 'createExpense':
      return { success: true, data: createExpense_(data), timestamp };
    case 'markPlannedExpensePaid':
      return { success: true, data: markPlannedExpensePaid_(data), timestamp };

    // Recurring Expenses
    case 'getRecurringExpenses':
      return { success: true, data: getRecurringExpenses_(), timestamp };
    case 'createRecurringExpense':
      return { success: true, data: createRecurringExpense_(data), timestamp };
    case 'updateRecurringExpense':
      return { success: true, data: updateRecurringExpense_(data), timestamp };

    // Adjustments
    case 'getAdjustments':
      return { success: true, data: getAdjustments_(data.cycleKey), timestamp };
    case 'createAdjustment':
      return { success: true, data: createAdjustment_(data), timestamp };

    // Settlements
    case 'getSettlements':
      return { success: true, data: getSettlements_(data.cycleKey), timestamp };
    case 'createSettlement':
      return { success: true, data: createSettlement_(data), timestamp };

    // Banks
    case 'getBanks':
      return { success: true, data: getBanks_(), timestamp };
    case 'createBank':
      return { success: true, data: createBank_(data), timestamp };

    // Categories
    case 'getCategories':
      return { success: true, data: getCategories_(), timestamp };
    case 'createCategory':
      return { success: true, data: createCategory_(data), timestamp };

    // Audit
    case 'getAuditLog':
      return { success: true, data: getAuditLog_(data), timestamp };

    // Snapshot (Dashboard/Reports)
    case 'getSnapshot':
      return { success: true, data: getSnapshot_(data.startCycle, data.endCycle), timestamp };

    // Member Ledger
    case 'getMemberLedger':
      return { success: true, data: getMemberLedger_(data.memberId), timestamp };

    // Initialize
    case 'initializeSystem':
      return { success: true, data: initializeSystem_(), timestamp };

    default:
      throw new Error('Unknown action: ' + action);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets the spreadsheet instance
 */
function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID not configured. Please set CONFIG.SPREADSHEET_ID in Code.gs');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Gets or creates a sheet by name
 */
function getSheet_(sheetName) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName + '. Please run initializeSystem first.');
  }
  return sheet;
}

/**
 * Generates a UUID
 */
function generateUUID_() {
  return Utilities.getUuid();
}

/**
 * Gets current user email
 */
function getCurrentUserEmail_() {
  return Session.getActiveUser().getEmail() || 'admin';
}

/**
 * Gets "today" in Asia/Riyadh timezone as YYYY-MM-DD
 */
function getTodayRiyadh_() {
  const now = new Date();
  const riyadhTime = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return riyadhTime;
}

/**
 * Gets current datetime in Asia/Riyadh timezone
 */
function getNowRiyadh_() {
  const now = new Date();
  return Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Parses a date string to Date object in Riyadh timezone
 */
function parseDateRiyadh_(dateStr) {
  // dateStr is YYYY-MM-DD
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  // Create date at noon to avoid timezone issues
  const date = new Date(year, month, day, 12, 0, 0);
  return date;
}

/**
 * Gets cycle key (YYYY-MM) from an operation date
 * Cycle runs from day 27 of previous month to day 26 of this month
 */
function getCycleKeyFromDate_(dateStr) {
  const date = parseDateRiyadh_(dateStr);
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth(); // 0-indexed

  if (day >= 27) {
    // This date is in the NEXT month's cycle
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const monthStr = String(month + 1).padStart(2, '0');
  return `${year}-${monthStr}`;
}

/**
 * Gets cycle name from cycle key
 * e.g., "2025-09" -> "September 2025"
 */
function getCycleNameFromKey_(cycleKey) {
  const parts = cycleKey.split('-');
  const year = parts[0];
  const month = parseInt(parts[1], 10) - 1;
  return `${MONTH_NAMES[month]} ${year}`;
}

/**
 * Gets cycle start date from cycle key
 * Cycle "2025-09" starts on 2025-08-27
 */
function getCycleStartDate_(cycleKey) {
  const parts = cycleKey.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1; // 0-indexed

  // Start is day 27 of previous month
  month -= 1;
  if (month < 0) {
    month = 11;
    year -= 1;
  }

  return `${year}-${String(month + 1).padStart(2, '0')}-27`;
}

/**
 * Gets cycle end date from cycle key
 * Cycle "2025-09" ends on 2025-09-26
 */
function getCycleEndDate_(cycleKey) {
  const parts = cycleKey.split('-');
  const year = parts[0];
  const month = parts[1];
  return `${year}-${month}-26`;
}

/**
 * Gets the next cycle key
 */
function getNextCycleKey_(cycleKey) {
  const parts = cycleKey.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);

  month += 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Gets the previous cycle key
 */
function getPreviousCycleKey_(cycleKey) {
  const parts = cycleKey.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);

  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Compares two cycle keys
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareCycleKeys_(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Rounds a number to 2 decimal places
 */
function roundToTwoDecimals_(num) {
  return Math.round(num * 100) / 100;
}

/**
 * Validates that amount is positive and has max 2 decimals
 */
function validateAmount_(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('INVALID_AMOUNT: Amount must be a number');
  }
  if (amount <= 0) {
    throw new Error('INVALID_AMOUNT: Amount must be positive');
  }
  const rounded = roundToTwoDecimals_(amount);
  if (Math.abs(amount - rounded) > 0.001) {
    throw new Error('INVALID_AMOUNT: Amount must have max 2 decimal places');
  }
  return rounded;
}

/**
 * Validates that a date is within allowed range and in an open cycle
 */
function validateOperationDate_(dateStr, allowClosed = false) {
  // Check format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('INVALID_DATE: Date must be in YYYY-MM-DD format');
  }

  // Check earliest allowed date
  if (dateStr < CONFIG.EARLIEST_ALLOWED_DATE) {
    throw new Error('INVALID_DATE: Date cannot be before ' + CONFIG.EARLIEST_ALLOWED_DATE);
  }

  // Get cycle for this date
  const cycleKey = getCycleKeyFromDate_(dateStr);

  // Check cycle exists and is open (unless allowClosed)
  const cycles = getCyclesData_();
  const cycle = cycles.find(c => c.cycleKey === cycleKey);

  if (!cycle) {
    throw new Error('INVALID_DATE: No cycle exists for date ' + dateStr);
  }

  if (!allowClosed && cycle.status === 'Closed') {
    throw new Error('CYCLE_CLOSED: Cannot record transactions in closed cycle ' + cycle.cycleName);
  }

  return cycleKey;
}

/**
 * Acquires a lock for write operations
 */
function acquireLock_() {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
  if (!acquired) {
    throw new Error('LOCK_TIMEOUT: Could not acquire write lock. Please try again.');
  }
  return lock;
}

/**
 * Converts sheet data to array of objects
 */
function sheetDataToObjects_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues(); // مهم: يرجّع النص الظاهر في الشيت

  if (values.length < 2) return [];

  const headers = values[0].map(h => String(h).trim());
  const objects = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const v = row[j];

      // إذا الشيت مخزنها كـ Date، خذ النص الظاهر بدل الـ Date object
      if (v instanceof Date) {
        obj[header] = display[i][j];
      } else {
        obj[header] = v;
      }
    }

    objects.push(obj);
  }

  return objects;
}


/**
 * Appends a row to a sheet
 */
function appendRow_(sheet, rowData, headers) {
  const row = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');
  sheet.appendRow(row);
}

/**
 * Updates a row in a sheet by ID column
 */
function updateRow_(sheet, idColumn, idValue, updates) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf(idColumn);

  if (idIndex === -1) {
    throw new Error('ID column not found: ' + idColumn);
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIndex] === idValue) {
      for (const [key, value] of Object.entries(updates)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * Writes to audit log
 */
function writeAuditLog_(action, entityType, entityId, beforeState, afterState, metadata = {}) {
  const sheet = getSheet_('Audit_Log');
  const logEntry = {
    logId: generateUUID_(),
    timestamp: getNowRiyadh_(),
    userEmail: getCurrentUserEmail_(),
    action: action,
    entityType: entityType,
    entityId: entityId,
    beforeState: JSON.stringify(beforeState || null),
    afterState: JSON.stringify(afterState || null),
    metadata: JSON.stringify(metadata)
  };

  const headers = ['logId', 'timestamp', 'userEmail', 'action', 'entityType', 'entityId', 'beforeState', 'afterState', 'metadata'];
  appendRow_(sheet, logEntry, headers);
}
