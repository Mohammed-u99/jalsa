/**
 * صندوق التكافل - النظام الرئيسي
 * نظام إدارة صندوق تكافلي بمساهمات طوعية بدون دورات شهرية
 * كل عضو يساهم بأي مبلغ وفي أي وقت يناسبه
 */

const CONFIG = {
  SPREADSHEET_ID: '',                    // يجب تعيين معرف جدول البيانات
  SCHEMA_VERSION: '1.0.0',
  TIMEZONE: 'Asia/Riyadh',
  OPENING_TREASURY_CASH: 0,             // رصيد الصندوق الافتتاحي (ريال)
  EARLIEST_ALLOWED_DATE: '2025-01-01',  // أقدم تاريخ مسموح به
  LOCK_TIMEOUT_MS: 30000                // مهلة القفل (30 ثانية)
};

// ===== نقاط الدخول =====

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (!action) {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('صندوق التكافل')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return handleApiRequest_(action, e.parameter, 'GET');
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return handleApiRequest_(body.action, body.data || {}, 'POST');
  } catch (err) {
    return createJsonResponse_(false, null, 'خطأ في تنسيق الطلب: ' + err.message);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===== التوجيه الرئيسي =====

function handleApiRequest_(action, data, method) {
  try {
    let result;
    switch (action) {
      // الإعدادات
      case 'getSettings':        result = getSettings_(); break;
      case 'updateSetting':      result = updateSetting_(data); break;
      case 'initializeSystem':   result = initializeSystem_(); break;

      // الأعضاء
      case 'getMembers':         result = getMembers_(); break;
      case 'createMember':       result = createMember_(data); break;
      case 'updateMember':       result = updateMember_(data); break;
      case 'markMemberInactive': result = markMemberInactive_(data); break;

      // المساهمات
      case 'getContributions':   result = getContributions_(); break;
      case 'createContribution': result = createContribution_(data); break;

      // المصروفات
      case 'getExpenses':        result = getExpenses_(); break;
      case 'createExpense':      result = createExpense_(data); break;

      // التعديلات
      case 'getAdjustments':     result = getAdjustments_(); break;
      case 'createAdjustment':   result = createAdjustment_(data); break;

      // التسويات
      case 'getSettlements':     result = getSettlements_(); break;
      case 'createSettlement':   result = createSettlement_(data); break;

      // البنوك
      case 'getBanks':           result = getBanks_(); break;
      case 'createBank':         result = createBank_(data); break;

      // الفئات
      case 'getCategories':      result = getCategories_(); break;
      case 'createCategory':     result = createCategory_(data); break;

      // سجل المراجعة
      case 'getAuditLog':        result = getAuditLog_(); break;

      // التقارير
      case 'getSnapshot':        result = getSnapshot_(data); break;
      case 'getMemberLedger':    result = getMemberLedger_(data); break;

      default:
        return createJsonResponse_(false, null, 'إجراء غير معروف: ' + action);
    }
    return createJsonResponse_(true, result);
  } catch (err) {
    return createJsonResponse_(false, null, err.message);
  }
}

// ===== الأدوات المساعدة =====

function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID) {
    throw new Error('SETUP_REQUIRED: يرجى تعيين معرف جدول البيانات في CONFIG.SPREADSHEET_ID');
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('SHEET_NOT_FOUND: الورقة "' + name + '" غير موجودة. يرجى تهيئة النظام أولاً.');
  }
  return sheet;
}

function createJsonResponse_(success, data, error) {
  const response = {
    success: success,
    data: data || null,
    error: error || null,
    timestamp: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function acquireLock_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT_MS)) {
    throw new Error('LOCK_TIMEOUT: النظام مشغول حالياً. يرجى المحاولة مرة أخرى.');
  }
  return lock;
}

function getTodayRiyadh_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function getNowRiyadh_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function sheetDataToObjects_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return rows;
}

function findRowIndex_(sheet, columnIndex, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][columnIndex]) === String(value)) {
      return i + 1;
    }
  }
  return -1;
}

function validateDate_(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('INVALID_DATE: صيغة التاريخ غير صحيحة. يجب أن تكون بتنسيق YYYY-MM-DD');
  }
  if (dateStr < CONFIG.EARLIEST_ALLOWED_DATE) {
    throw new Error('INVALID_DATE: التاريخ قبل أقدم تاريخ مسموح به (' + CONFIG.EARLIEST_ALLOWED_DATE + ')');
  }
}

function validateAmount_(amount) {
  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('INVALID_AMOUNT: المبلغ يجب أن يكون رقماً موجباً');
  }
  return Math.round(num * 100) / 100;
}

function writeAuditLog_(action, entityType, entityId, beforeState, afterState, metadata) {
  try {
    const sheet = getSheet_('Audit_Log');
    sheet.appendRow([
      Utilities.getUuid(),
      getNowRiyadh_(),
      Session.getActiveUser().getEmail() || 'النظام',
      action,
      entityType,
      entityId || '',
      beforeState ? JSON.stringify(beforeState) : '',
      afterState ? JSON.stringify(afterState) : '',
      metadata ? JSON.stringify(metadata) : ''
    ]);
  } catch (e) {
    console.error('خطأ في كتابة سجل المراجعة: ' + e.message);
  }
}

function getMonthName_(monthNum) {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  return months[monthNum - 1] || '';
}

function formatDateArabic_(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return parts[2] + ' ' + getMonthName_(parseInt(parts[1])) + ' ' + parts[0];
}
