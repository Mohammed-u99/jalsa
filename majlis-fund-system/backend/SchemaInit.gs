/**
 * Majlis Fund System - Schema Initialization
 * Handles initial setup and migrations
 */

// ============================================================================
// SHEET DEFINITIONS
// ============================================================================

const SHEET_DEFINITIONS = {
  Settings: {
    headers: ['key', 'value', 'schemaVersion', 'updatedAt', 'updatedBy'],
    defaults: [
      { key: 'schemaVersion', value: '1.0.0' },
      { key: 'openingTreasuryCash', value: '3000' },
      { key: 'defaultDueAmount', value: '150' },
      { key: 'systemStartCycle', value: '2025-09' },
      { key: 'earliestAllowedDate', value: '2025-08-27' },
      { key: 'timezone', value: 'Asia/Riyadh' }
    ]
  },

  Cycles: {
    headers: ['cycleId', 'cycleKey', 'cycleName', 'startDate', 'endDate', 'status',
              'dueAmountOverride', 'closedAt', 'paymentStatusSnapshot', 'schemaVersion',
              'createdAt', 'updatedAt']
  },

  Members: {
    headers: ['memberId', 'displayName', 'startCycle', 'endCycle', 'status',
              'phone', 'email', 'notes', 'schemaVersion', 'createdAt', 'createdBy',
              'updatedAt', 'updatedBy']
  },

  Dues: {
    headers: ['dueId', 'memberId', 'cycleKey', 'amount', 'generatedAt', 'schemaVersion', 'createdAt']
  },

  Payments: {
    headers: ['paymentId', 'memberId', 'operationDate', 'cycleKey', 'amount', 'method',
              'bankName', 'transferNote', 'notes', 'schemaVersion', 'createdAt', 'createdBy',
              'updatedAt', 'updatedBy']
  },

  Expenses: {
    headers: ['expenseId', 'operationDate', 'cycleKey', 'category', 'description', 'amount',
              'paidBy', 'paidByMemberId', 'recurringExpenseId', 'isPlanned', 'notes',
              'schemaVersion', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']
  },

  Recurring_Expenses: {
    headers: ['recurringExpenseId', 'category', 'description', 'type', 'defaultAmount',
              'isActive', 'schemaVersion', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy']
  },

  Adjustments: {
    headers: ['adjustmentId', 'operationDate', 'cycleKey', 'entityType', 'entityId',
              'memberId', 'amount', 'reason', 'notes', 'schemaVersion', 'createdAt', 'createdBy']
  },

  Settlements: {
    headers: ['settlementId', 'memberId', 'operationDate', 'cycleKey', 'amount',
              'method', 'notes', 'schemaVersion', 'createdAt', 'createdBy']
  },

  Banks: {
    headers: ['bankId', 'bankName', 'isActive', 'schemaVersion', 'createdAt'],
    defaults: [
      { bankName: 'AlAhli' },
      { bankName: 'Riyad' },
      { bankName: 'STC' },
      { bankName: 'D360' },
      { bankName: 'Barq' },
      { bankName: 'Tickmo' }
    ]
  },

  Categories: {
    headers: ['categoryId', 'categoryName', 'isActive', 'schemaVersion', 'createdAt'],
    defaults: [
      { categoryName: 'Rent' },
      { categoryName: 'Electricity' },
      { categoryName: 'Water' },
      { categoryName: 'Cleaning' }
    ]
  },

  Audit_Log: {
    headers: ['logId', 'timestamp', 'userEmail', 'action', 'entityType', 'entityId',
              'beforeState', 'afterState', 'metadata']
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the entire system (creates sheets, default data, first cycle)
 */
function initializeSystem_() {
  const lock = acquireLock_();

  try {
    const ss = getSpreadsheet_();
    const results = {
      sheetsCreated: [],
      sheetsExisting: [],
      defaultsAdded: [],
      initialCycleCreated: false,
      openingBalanceCreated: false
    };

    // Create all sheets
    for (const [sheetName, definition] of Object.entries(SHEET_DEFINITIONS)) {
      let sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]);
        sheet.getRange(1, 1, 1, definition.headers.length).setFontWeight('bold');
        results.sheetsCreated.push(sheetName);

        // Add defaults if defined
        if (definition.defaults) {
          for (const defaultRow of definition.defaults) {
            const row = createDefaultRow_(sheetName, defaultRow);
            appendRow_(sheet, row, definition.headers);
          }
          results.defaultsAdded.push(sheetName);
        }
      } else {
        results.sheetsExisting.push(sheetName);
      }
    }

    // Ensure cycles are current
    const cycleResult = ensureCyclesCurrent_();
    results.initialCycleCreated = cycleResult.cyclesCreated > 0;

    // Create opening balance adjustment if no adjustments exist
    const adjustmentsSheet = ss.getSheetByName('Adjustments');
    const adjustmentsData = adjustmentsSheet.getDataRange().getValues();
    if (adjustmentsData.length <= 1) {
      // Create opening balance
      const openingBalanceAdj = {
        adjustmentId: generateUUID_(),
        operationDate: CONFIG.EARLIEST_ALLOWED_DATE,
        cycleKey: CONFIG.SYSTEM_START_CYCLE,
        entityType: 'OpeningBalance',
        entityId: 'SYSTEM_INIT',
        memberId: '',
        amount: CONFIG.OPENING_TREASURY_CASH,
        reason: 'System initialization - Opening treasury balance',
        notes: 'Initial treasury cash balance of 3000 SAR',
        schemaVersion: CONFIG.SCHEMA_VERSION,
        createdAt: getNowRiyadh_(),
        createdBy: getCurrentUserEmail_()
      };

      appendRow_(adjustmentsSheet, openingBalanceAdj, SHEET_DEFINITIONS.Adjustments.headers);
      results.openingBalanceCreated = true;

      writeAuditLog_('CREATE', 'OpeningBalance', openingBalanceAdj.adjustmentId, null, openingBalanceAdj);
    }

    writeAuditLog_('SYSTEM_INIT', 'System', 'INIT', null, results);

    return results;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates a default row with standard fields populated
 */
function createDefaultRow_(sheetName, data) {
  const now = getNowRiyadh_();
  const user = getCurrentUserEmail_();
  const row = { ...data };

  // Add common fields based on sheet type
  if (sheetName === 'Settings') {
    row.schemaVersion = CONFIG.SCHEMA_VERSION;
    row.updatedAt = now;
    row.updatedBy = user;
  } else if (sheetName === 'Banks') {
    row.bankId = generateUUID_();
    row.isActive = true;
    row.schemaVersion = CONFIG.SCHEMA_VERSION;
    row.createdAt = now;
  } else if (sheetName === 'Categories') {
    row.categoryId = generateUUID_();
    row.isActive = true;
    row.schemaVersion = CONFIG.SCHEMA_VERSION;
    row.createdAt = now;
  }

  return row;
}

/**
 * Runs migrations for schema updates
 */
function runMigrations_() {
  const currentVersion = getSettingValue_('schemaVersion') || '1.0.0';
  const targetVersion = CONFIG.SCHEMA_VERSION;

  if (currentVersion === targetVersion) {
    return { migrated: false, message: 'Already at latest version ' + targetVersion };
  }

  // Migration logic would go here for future versions
  // Example:
  // if (compareVersions(currentVersion, '1.1.0') < 0) {
  //   migrate_1_0_0_to_1_1_0();
  // }

  // Update schema version
  updateSettingValue_('schemaVersion', targetVersion);

  return {
    migrated: true,
    fromVersion: currentVersion,
    toVersion: targetVersion
  };
}

/**
 * Gets a setting value
 */
function getSettingValue_(key) {
  const sheet = getSheet_('Settings');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return null;
}

/**
 * Updates a setting value
 */
function updateSettingValue_(key, value) {
  const sheet = getSheet_('Settings');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIndex = headers.indexOf('key');
  const valueIndex = headers.indexOf('value');
  const updatedAtIndex = headers.indexOf('updatedAt');
  const updatedByIndex = headers.indexOf('updatedBy');

  for (let i = 1; i < data.length; i++) {
    if (data[i][keyIndex] === key) {
      sheet.getRange(i + 1, valueIndex + 1).setValue(value);
      sheet.getRange(i + 1, updatedAtIndex + 1).setValue(getNowRiyadh_());
      sheet.getRange(i + 1, updatedByIndex + 1).setValue(getCurrentUserEmail_());
      return true;
    }
  }

  // Key doesn't exist, add it
  appendRow_(sheet, {
    key: key,
    value: value,
    schemaVersion: CONFIG.SCHEMA_VERSION,
    updatedAt: getNowRiyadh_(),
    updatedBy: getCurrentUserEmail_()
  }, headers);

  return true;
}
