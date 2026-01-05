/**
 * Majlis Fund System - Settings, Banks, Categories, Audit
 */

// ============================================================================
// SETTINGS
// ============================================================================

function getSettings_() {
  const sheet = getSheet_('Settings');
  const data = sheetDataToObjects_(sheet);

  const settings = {};
  for (const row of data) {
    settings[row.key] = row.value;
  }

  // Parse numeric values
  if (settings.openingTreasuryCash) {
    settings.openingTreasuryCash = parseFloat(settings.openingTreasuryCash);
  }
  if (settings.defaultDueAmount) {
    settings.defaultDueAmount = parseFloat(settings.defaultDueAmount);
  }

  return settings;
}

function updateSetting_(data) {
  const lock = acquireLock_();

  try {
    if (!data.key || data.value === undefined) {
      throw new Error('VALIDATION_ERROR: key and value are required');
    }

    // Don't allow changing critical system settings
    const protectedKeys = ['systemStartCycle', 'earliestAllowedDate', 'schemaVersion'];
    if (protectedKeys.includes(data.key)) {
      throw new Error('VALIDATION_ERROR: Cannot modify protected setting: ' + data.key);
    }

    const before = getSettingValue_(data.key);
    updateSettingValue_(data.key, String(data.value));

    writeAuditLog_('UPDATE', 'Setting', data.key, { value: before }, { value: data.value });

    return { key: data.key, value: data.value };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// BANKS
// ============================================================================

function getBanks_() {
  const sheet = getSheet_('Banks');
  const banks = sheetDataToObjects_(sheet);
  return { banks: banks.filter(b => b.isActive !== false && b.isActive !== 'false') };
}

function createBank_(data) {
  const lock = acquireLock_();

  try {
    if (!data.bankName || !data.bankName.trim()) {
      throw new Error('VALIDATION_ERROR: bankName is required');
    }

    const bankName = data.bankName.trim();

    // Check unique
    const banks = sheetDataToObjects_(getSheet_('Banks'));
    if (banks.some(b => b.bankName.toLowerCase() === bankName.toLowerCase())) {
      throw new Error('DUPLICATE_NAME: A bank with this name already exists');
    }

    const sheet = getSheet_('Banks');
    const now = getNowRiyadh_();

    const bank = {
      bankId: generateUUID_(),
      bankName: bankName,
      isActive: true,
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now
    };

    appendRow_(sheet, bank, SHEET_DEFINITIONS.Banks.headers);

    writeAuditLog_('CREATE', 'Bank', bank.bankId, null, bank);

    return { bank };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

function getCategories_() {
  const sheet = getSheet_('Categories');
  const categories = sheetDataToObjects_(sheet);
  return { categories: categories.filter(c => c.isActive !== false && c.isActive !== 'false') };
}

function createCategory_(data) {
  const lock = acquireLock_();

  try {
    if (!data.categoryName || !data.categoryName.trim()) {
      throw new Error('VALIDATION_ERROR: categoryName is required');
    }

    const categoryName = data.categoryName.trim();

    // Check unique
    const categories = sheetDataToObjects_(getSheet_('Categories'));
    if (categories.some(c => c.categoryName.toLowerCase() === categoryName.toLowerCase())) {
      throw new Error('DUPLICATE_NAME: A category with this name already exists');
    }

    const sheet = getSheet_('Categories');
    const now = getNowRiyadh_();

    const category = {
      categoryId: generateUUID_(),
      categoryName: categoryName,
      isActive: true,
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now
    };

    appendRow_(sheet, category, SHEET_DEFINITIONS.Categories.headers);

    writeAuditLog_('CREATE', 'Category', category.categoryId, null, category);

    return { category };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// AUDIT LOG
// ============================================================================

function getAuditLog_(data) {
  const sheet = getSheet_('Audit_Log');
  let logs = sheetDataToObjects_(sheet);

  // Filter by entityType and/or entityId if provided
  if (data && data.entityType) {
    logs = logs.filter(l => l.entityType === data.entityType);
  }
  if (data && data.entityId) {
    logs = logs.filter(l => l.entityId === data.entityId);
  }

  // Sort by timestamp descending (most recent first)
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Limit to last 100 entries by default
  const limit = (data && data.limit) || 100;
  logs = logs.slice(0, limit);

  return {
    logs: logs.map(l => ({
      ...l,
      beforeState: l.beforeState ? JSON.parse(l.beforeState) : null,
      afterState: l.afterState ? JSON.parse(l.afterState) : null,
      metadata: l.metadata ? JSON.parse(l.metadata) : null
    }))
  };
}
