/**
 * الإعدادات والبنوك والفئات وسجل المراجعة
 */

// ===== الإعدادات =====

function getSettings_() {
  const sheet = getSheet_('Settings');
  const data = sheetDataToObjects_(sheet);
  const settings = {};
  data.forEach(function(row) {
    settings[row.key] = row.value;
  });
  return settings;
}

function updateSetting_(data) {
  if (!data.key) throw new Error('VALIDATION_ERROR: مفتاح الإعداد مطلوب');

  // الإعدادات المحمية لا يمكن تعديلها
  const protectedKeys = ['schemaVersion'];
  if (protectedKeys.includes(data.key)) {
    throw new Error('VALIDATION_ERROR: لا يمكن تعديل هذا الإعداد');
  }

  const lock = acquireLock_();
  try {
    const sheet = getSheet_('Settings');
    const settings = sheetDataToObjects_(sheet);
    const existing = settings.find(function(s) { return s.key === data.key; });

    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';

    if (existing) {
      const rowIndex = findRowIndex_(sheet, 0, data.key);
      if (rowIndex !== -1) {
        sheet.getRange(rowIndex, 2).setValue(data.value);
        sheet.getRange(rowIndex, 3).setValue(now);
        sheet.getRange(rowIndex, 4).setValue(user);
      }
    } else {
      sheet.appendRow([data.key, data.value, now, user]);
    }

    writeAuditLog_('UPDATE_SETTING', 'Setting', data.key,
      { value: existing ? existing.value : null },
      { value: data.value },
      null
    );

    return { message: 'تم تحديث الإعداد بنجاح' };
  } finally {
    lock.releaseLock();
  }
}

// ===== البنوك =====

function getBanks_() {
  const sheet = getSheet_('Banks');
  return sheetDataToObjects_(sheet).map(function(b) {
    return {
      bankId: b.bankId,
      bankName: b.bankName,
      isActive: b.isActive !== false && b.isActive !== 'false'
    };
  });
}

function createBank_(data) {
  if (!data.bankName || !String(data.bankName).trim()) {
    throw new Error('VALIDATION_ERROR: اسم البنك مطلوب');
  }

  const lock = acquireLock_();
  try {
    const sheet = getSheet_('Banks');
    const banks = sheetDataToObjects_(sheet);
    const name = String(data.bankName).trim();

    const duplicate = banks.find(function(b) {
      return b.bankName.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      throw new Error('DUPLICATE_NAME: يوجد بنك بنفس الاسم "' + name + '" مسبقاً');
    }

    const bankId = Utilities.getUuid();
    sheet.appendRow([bankId, name, true, getNowRiyadh_()]);

    writeAuditLog_('CREATE_BANK', 'Bank', bankId, null, { bankName: name }, null);

    return {
      bankId: bankId,
      message: 'تم إضافة البنك "' + name + '" بنجاح'
    };
  } finally {
    lock.releaseLock();
  }
}

// ===== الفئات =====

function getCategories_() {
  const sheet = getSheet_('Categories');
  return sheetDataToObjects_(sheet).map(function(c) {
    return {
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      isActive: c.isActive !== false && c.isActive !== 'false'
    };
  });
}

function createCategory_(data) {
  if (!data.categoryName || !String(data.categoryName).trim()) {
    throw new Error('VALIDATION_ERROR: اسم الفئة مطلوب');
  }

  const lock = acquireLock_();
  try {
    const sheet = getSheet_('Categories');
    const categories = sheetDataToObjects_(sheet);
    const name = String(data.categoryName).trim();

    const duplicate = categories.find(function(c) {
      return c.categoryName.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      throw new Error('DUPLICATE_NAME: توجد فئة بنفس الاسم "' + name + '" مسبقاً');
    }

    const categoryId = Utilities.getUuid();
    sheet.appendRow([categoryId, name, true, getNowRiyadh_()]);

    writeAuditLog_('CREATE_CATEGORY', 'Category', categoryId, null, { categoryName: name }, null);

    return {
      categoryId: categoryId,
      message: 'تم إضافة الفئة "' + name + '" بنجاح'
    };
  } finally {
    lock.releaseLock();
  }
}

// ===== سجل المراجعة =====

function getAuditLog_() {
  const sheet = getSheet_('Audit_Log');
  const logs = sheetDataToObjects_(sheet);

  return logs.map(function(log) {
    return {
      logId: log.logId,
      timestamp: log.timestamp,
      userEmail: log.userEmail,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeState: log.beforeState ? tryParseJson_(log.beforeState) : null,
      afterState: log.afterState ? tryParseJson_(log.afterState) : null,
      metadata: log.metadata ? tryParseJson_(log.metadata) : null
    };
  }).reverse(); // الأحدث أولاً
}

function tryParseJson_(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}
