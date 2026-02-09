/**
 * المعاملات المالية
 * المساهمات - المصروفات - التعديلات - التسويات
 */

// ===== المساهمات =====

function getContributions_() {
  const sheet = getSheet_('Contributions');
  const contributions = sheetDataToObjects_(sheet);
  const members = getMembersData_();

  return contributions.map(function(c) {
    const member = members.find(function(m) { return m.memberId === c.memberId; });
    return {
      contributionId: c.contributionId,
      memberId: c.memberId,
      memberName: member ? member.displayName : 'غير معروف',
      operationDate: c.operationDate,
      amount: Number(c.amount),
      method: c.method,
      bankName: c.bankName || '',
      notes: c.notes || '',
      createdAt: c.createdAt
    };
  });
}

function createContribution_(data) {
  if (!data.memberId) throw new Error('VALIDATION_ERROR: يرجى اختيار العضو');
  if (!data.operationDate) throw new Error('VALIDATION_ERROR: التاريخ مطلوب');
  if (!data.amount) throw new Error('VALIDATION_ERROR: المبلغ مطلوب');

  validateDate_(data.operationDate);
  const amount = validateAmount_(data.amount);

  const method = data.method || 'نقدي';
  if (method !== 'نقدي' && method !== 'تحويل بنكي') {
    throw new Error('VALIDATION_ERROR: طريقة الدفع يجب أن تكون "نقدي" أو "تحويل بنكي"');
  }

  if (method === 'تحويل بنكي' && !data.bankName) {
    throw new Error('VALIDATION_ERROR: اسم البنك مطلوب عند اختيار التحويل البنكي');
  }

  const lock = acquireLock_();
  try {
    // التحقق من وجود العضو
    const members = getMembersData_();
    const member = members.find(function(m) { return m.memberId === data.memberId; });
    if (!member) {
      throw new Error('NOT_FOUND: العضو غير موجود');
    }

    const sheet = getSheet_('Contributions');
    const contributionId = Utilities.getUuid();
    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';

    sheet.appendRow([
      contributionId,
      data.memberId,
      data.operationDate,
      amount,
      method,
      method === 'تحويل بنكي' ? data.bankName : '',
      data.notes || '',
      now,
      user
    ]);

    writeAuditLog_('CREATE_CONTRIBUTION', 'Contribution', contributionId, null, {
      memberId: data.memberId,
      memberName: member.displayName,
      amount: amount,
      method: method,
      operationDate: data.operationDate
    }, null);

    return {
      contributionId: contributionId,
      message: 'تم تسجيل مساهمة بمبلغ ' + amount + ' ريال للعضو "' + member.displayName + '"'
    };
  } finally {
    lock.releaseLock();
  }
}

// ===== المصروفات =====

function getExpenses_() {
  const sheet = getSheet_('Expenses');
  const expenses = sheetDataToObjects_(sheet);
  const members = getMembersData_();

  return expenses.map(function(e) {
    const member = e.memberId ? members.find(function(m) { return m.memberId === e.memberId; }) : null;
    return {
      expenseId: e.expenseId,
      operationDate: e.operationDate,
      category: e.category,
      description: e.description || '',
      amount: Number(e.amount),
      paidBy: e.paidBy,
      memberId: e.memberId || '',
      memberName: member ? member.displayName : '',
      notes: e.notes || '',
      createdAt: e.createdAt
    };
  });
}

function createExpense_(data) {
  if (!data.operationDate) throw new Error('VALIDATION_ERROR: التاريخ مطلوب');
  if (!data.category) throw new Error('VALIDATION_ERROR: فئة المصروف مطلوبة');
  if (!data.amount) throw new Error('VALIDATION_ERROR: المبلغ مطلوب');

  validateDate_(data.operationDate);
  const amount = validateAmount_(data.amount);

  const paidBy = data.paidBy || 'الصندوق';
  if (paidBy !== 'الصندوق' && paidBy !== 'عضو') {
    throw new Error('VALIDATION_ERROR: الدافع يجب أن يكون "الصندوق" أو "عضو"');
  }

  if (paidBy === 'عضو' && !data.memberId) {
    throw new Error('VALIDATION_ERROR: يرجى تحديد العضو الذي دفع المصروف');
  }

  const lock = acquireLock_();
  try {
    // التحقق من العضو إذا كان هو الدافع
    if (paidBy === 'عضو') {
      const members = getMembersData_();
      const member = members.find(function(m) { return m.memberId === data.memberId; });
      if (!member) {
        throw new Error('NOT_FOUND: العضو غير موجود');
      }
    }

    const sheet = getSheet_('Expenses');
    const expenseId = Utilities.getUuid();
    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';

    sheet.appendRow([
      expenseId,
      data.operationDate,
      data.category,
      data.description || '',
      amount,
      paidBy,
      paidBy === 'عضو' ? data.memberId : '',
      data.notes || '',
      now,
      user
    ]);

    writeAuditLog_('CREATE_EXPENSE', 'Expense', expenseId, null, {
      category: data.category,
      amount: amount,
      paidBy: paidBy,
      operationDate: data.operationDate
    }, null);

    return {
      expenseId: expenseId,
      message: 'تم تسجيل مصروف بمبلغ ' + amount + ' ريال في فئة "' + data.category + '"'
    };
  } finally {
    lock.releaseLock();
  }
}

// ===== التعديلات =====

function getAdjustments_() {
  const sheet = getSheet_('Adjustments');
  const adjustments = sheetDataToObjects_(sheet);
  const members = getMembersData_();

  return adjustments.map(function(a) {
    const member = a.memberId ? members.find(function(m) { return m.memberId === a.memberId; }) : null;
    return {
      adjustmentId: a.adjustmentId,
      operationDate: a.operationDate,
      entityType: a.entityType,
      entityId: a.entityId || '',
      memberId: a.memberId || '',
      memberName: member ? member.displayName : '',
      amount: Number(a.amount),
      reason: a.reason || '',
      createdAt: a.createdAt
    };
  });
}

function createAdjustment_(data) {
  if (!data.operationDate) throw new Error('VALIDATION_ERROR: التاريخ مطلوب');
  if (!data.reason) throw new Error('VALIDATION_ERROR: سبب التعديل مطلوب');
  if (data.amount === undefined || data.amount === null || data.amount === '') {
    throw new Error('VALIDATION_ERROR: المبلغ مطلوب');
  }

  validateDate_(data.operationDate);
  const amount = Number(data.amount);
  if (isNaN(amount) || amount === 0) {
    throw new Error('INVALID_AMOUNT: المبلغ يجب أن يكون رقماً غير صفري');
  }
  const roundedAmount = Math.round(amount * 100) / 100;

  const entityType = data.entityType || 'عام';

  const lock = acquireLock_();
  try {
    // التحقق من العضو إذا تم تحديده
    if (data.memberId) {
      const members = getMembersData_();
      const member = members.find(function(m) { return m.memberId === data.memberId; });
      if (!member) {
        throw new Error('NOT_FOUND: العضو غير موجود');
      }
    }

    const sheet = getSheet_('Adjustments');
    const adjustmentId = Utilities.getUuid();
    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';

    sheet.appendRow([
      adjustmentId,
      data.operationDate,
      entityType,
      data.entityId || '',
      data.memberId || '',
      roundedAmount,
      data.reason,
      now,
      user
    ]);

    writeAuditLog_('CREATE_ADJUSTMENT', 'Adjustment', adjustmentId, null, {
      entityType: entityType,
      memberId: data.memberId || '',
      amount: roundedAmount,
      reason: data.reason
    }, null);

    const typeLabel = roundedAmount > 0 ? 'إضافة' : 'خصم';
    return {
      adjustmentId: adjustmentId,
      message: 'تم تسجيل تعديل (' + typeLabel + ') بمبلغ ' + Math.abs(roundedAmount) + ' ريال'
    };
  } finally {
    lock.releaseLock();
  }
}

// ===== التسويات =====

function getSettlements_() {
  const sheet = getSheet_('Settlements');
  const settlements = sheetDataToObjects_(sheet);
  const members = getMembersData_();

  return settlements.map(function(s) {
    const member = members.find(function(m) { return m.memberId === s.memberId; });
    return {
      settlementId: s.settlementId,
      memberId: s.memberId,
      memberName: member ? member.displayName : 'غير معروف',
      operationDate: s.operationDate,
      amount: Number(s.amount),
      reason: s.reason || '',
      createdAt: s.createdAt
    };
  });
}

function createSettlement_(data) {
  if (!data.memberId) throw new Error('VALIDATION_ERROR: يرجى اختيار العضو');
  if (!data.operationDate) throw new Error('VALIDATION_ERROR: التاريخ مطلوب');
  if (!data.amount) throw new Error('VALIDATION_ERROR: المبلغ مطلوب');

  validateDate_(data.operationDate);
  const amount = validateAmount_(data.amount);

  const lock = acquireLock_();
  try {
    const members = getMembersData_();
    const member = members.find(function(m) { return m.memberId === data.memberId; });
    if (!member) {
      throw new Error('NOT_FOUND: العضو غير موجود');
    }

    const sheet = getSheet_('Settlements');
    const settlementId = Utilities.getUuid();
    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';

    sheet.appendRow([
      settlementId,
      data.memberId,
      data.operationDate,
      amount,
      data.reason || '',
      now,
      user
    ]);

    writeAuditLog_('CREATE_SETTLEMENT', 'Settlement', settlementId, null, {
      memberId: data.memberId,
      memberName: member.displayName,
      amount: amount,
      operationDate: data.operationDate
    }, null);

    return {
      settlementId: settlementId,
      message: 'تم تسجيل تسوية بمبلغ ' + amount + ' ريال للعضو "' + member.displayName + '"'
    };
  } finally {
    lock.releaseLock();
  }
}
