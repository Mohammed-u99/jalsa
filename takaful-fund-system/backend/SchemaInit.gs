/**
 * تهيئة قاعدة البيانات
 * إنشاء جميع الأوراق والأعمدة المطلوبة للنظام
 */

function initializeSystem_() {
  const lock = acquireLock_();
  try {
    const ss = getSpreadsheet_();

    const sheets = {
      'Settings': [
        'key', 'value', 'updatedAt', 'updatedBy'
      ],
      'Members': [
        'memberId', 'displayName', 'joinDate', 'status',
        'phone', 'email', 'notes',
        'createdAt', 'createdBy', 'updatedAt', 'updatedBy'
      ],
      'Contributions': [
        'contributionId', 'memberId', 'operationDate', 'amount',
        'method', 'bankName', 'notes',
        'createdAt', 'createdBy'
      ],
      'Expenses': [
        'expenseId', 'operationDate', 'category', 'description',
        'amount', 'paidBy', 'memberId', 'notes',
        'createdAt', 'createdBy'
      ],
      'Adjustments': [
        'adjustmentId', 'operationDate', 'entityType', 'entityId',
        'memberId', 'amount', 'reason',
        'createdAt', 'createdBy'
      ],
      'Settlements': [
        'settlementId', 'memberId', 'operationDate', 'amount',
        'reason', 'createdAt', 'createdBy'
      ],
      'Banks': [
        'bankId', 'bankName', 'isActive', 'createdAt'
      ],
      'Categories': [
        'categoryId', 'categoryName', 'isActive', 'createdAt'
      ],
      'Audit_Log': [
        'logId', 'timestamp', 'userEmail', 'action',
        'entityType', 'entityId',
        'beforeState', 'afterState', 'metadata'
      ]
    };

    const created = [];
    const existing = [];

    for (const [sheetName, headers] of Object.entries(sheets)) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
        created.push(sheetName);
      } else {
        // التحقق من الأعمدة وإصلاحها إذا لزم الأمر
        const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
        if (existingHeaders.length < headers.length || existingHeaders[0] !== headers[0]) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
          sheet.setFrozenRows(1);
        }
        existing.push(sheetName);
      }
    }

    // تهيئة الإعدادات الافتراضية
    initializeDefaultSettings_(ss);

    writeAuditLog_('SYSTEM_INIT', 'System', null, null,
      { created: created, existing: existing }, null);

    return {
      message: 'تم تهيئة النظام بنجاح',
      sheetsCreated: created,
      sheetsExisting: existing
    };
  } finally {
    lock.releaseLock();
  }
}

function initializeDefaultSettings_(ss) {
  const settingsSheet = ss.getSheetByName('Settings');
  const settingsData = sheetDataToObjects_(settingsSheet);
  const existingKeys = settingsData.map(function(s) { return s.key; });

  const defaults = {
    'schemaVersion': CONFIG.SCHEMA_VERSION,
    'fundName': 'صندوق التكافل',
    'openingTreasuryCash': String(CONFIG.OPENING_TREASURY_CASH),
    'earliestAllowedDate': CONFIG.EARLIEST_ALLOWED_DATE,
    'currency': 'ريال'
  };

  const now = getNowRiyadh_();
  const user = Session.getActiveUser().getEmail() || 'النظام';

  for (const [key, value] of Object.entries(defaults)) {
    if (!existingKeys.includes(key)) {
      settingsSheet.appendRow([key, value, now, user]);
    }
  }
}
