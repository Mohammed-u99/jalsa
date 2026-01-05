/**
 * Majlis Fund System - Transactions (Payments, Expenses, Adjustments, Settlements)
 */

// ============================================================================
// DATA ACCESS FUNCTIONS
// ============================================================================

function getDuesData_() {
  const sheet = getSheet_('Dues');
  return sheetDataToObjects_(sheet);
}

function getPaymentsData_() {
  const sheet = getSheet_('Payments');
  return sheetDataToObjects_(sheet);
}

function getExpensesData_() {
  const sheet = getSheet_('Expenses');
  return sheetDataToObjects_(sheet);
}

function getRecurringExpensesData_() {
  const sheet = getSheet_('Recurring_Expenses');
  return sheetDataToObjects_(sheet);
}

function getAdjustmentsData_() {
  const sheet = getSheet_('Adjustments');
  return sheetDataToObjects_(sheet);
}

function getSettlementsData_() {
  const sheet = getSheet_('Settlements');
  return sheetDataToObjects_(sheet);
}

// ============================================================================
// DUES
// ============================================================================

function getDues_(cycleKey) {
  let dues = getDuesData_();

  if (cycleKey) {
    dues = dues.filter(d => d.cycleKey === cycleKey);
  }

  const members = getMembersData_();
  const membersMap = {};
  members.forEach(m => membersMap[m.memberId] = m.displayName);

  return {
    dues: dues.map(d => ({
      ...d,
      memberName: membersMap[d.memberId],
      cycleName: getCycleNameFromKey_(d.cycleKey)
    }))
  };
}

// ============================================================================
// PAYMENTS
// ============================================================================

function getPayments_(cycleKey) {
  let payments = getPaymentsData_();

  if (cycleKey) {
    payments = payments.filter(p => p.cycleKey === cycleKey);
  }

  const members = getMembersData_();
  const membersMap = {};
  members.forEach(m => membersMap[m.memberId] = m.displayName);

  return {
    payments: payments.map(p => ({
      ...p,
      memberName: membersMap[p.memberId],
      cycleName: getCycleNameFromKey_(p.cycleKey)
    }))
  };
}

function createPayment_(data) {
  const lock = acquireLock_();

  try {
    // Validate member
    if (!data.memberId) {
      throw new Error('VALIDATION_ERROR: memberId is required');
    }

    const member = getMemberById_(data.memberId);
    if (!member) {
      throw new Error('NOT_FOUND: Member not found');
    }

    // Validate amount
    const amount = validateAmount_(parseFloat(data.amount));

    // Validate and get operation date
    const operationDate = data.operationDate || getTodayRiyadh_();
    const cycleKey = validateOperationDate_(operationDate);

    // Validate method
    const validMethods = ['Cash', 'BankTransfer'];
    if (!validMethods.includes(data.method)) {
      throw new Error('VALIDATION_ERROR: method must be Cash or BankTransfer');
    }

    // Validate bank if BankTransfer
    if (data.method === 'BankTransfer' && !data.bankName) {
      throw new Error('VALIDATION_ERROR: bankName is required for BankTransfer');
    }

    const sheet = getSheet_('Payments');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const payment = {
      paymentId: generateUUID_(),
      memberId: data.memberId,
      operationDate: operationDate,
      cycleKey: cycleKey,
      amount: amount,
      method: data.method,
      bankName: data.bankName || '',
      transferNote: data.transferNote || '',
      notes: data.notes || '',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: user,
      updatedAt: now,
      updatedBy: user
    };

    appendRow_(sheet, payment, SHEET_DEFINITIONS.Payments.headers);

    writeAuditLog_('CREATE', 'Payment', payment.paymentId, null, payment);

    // Update member status if they were LeftOpenDebt
    updateMemberStatusIfNeeded_(data.memberId);

    return { payment };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// EXPENSES
// ============================================================================

function getExpenses_(cycleKey) {
  let expenses = getExpensesData_();

  if (cycleKey) {
    expenses = expenses.filter(e => e.cycleKey === cycleKey);
  }

  const members = getMembersData_();
  const membersMap = {};
  members.forEach(m => membersMap[m.memberId] = m.displayName);

  return {
    expenses: expenses.map(e => ({
      ...e,
      paidByMemberName: e.paidByMemberId ? membersMap[e.paidByMemberId] : null,
      cycleName: getCycleNameFromKey_(e.cycleKey)
    }))
  };
}

function createExpense_(data) {
  const lock = acquireLock_();

  try {
    // Validate amount
    const amount = validateAmount_(parseFloat(data.amount));

    // Validate and get operation date
    const operationDate = data.operationDate || getTodayRiyadh_();
    const cycleKey = validateOperationDate_(operationDate);

    // Validate paidBy
    const validPaidBy = ['Treasury', 'Member'];
    if (!validPaidBy.includes(data.paidBy)) {
      throw new Error('VALIDATION_ERROR: paidBy must be Treasury or Member');
    }

    // Validate member if paidBy Member
    if (data.paidBy === 'Member') {
      if (!data.paidByMemberId) {
        throw new Error('VALIDATION_ERROR: paidByMemberId is required when paidBy is Member');
      }
      const member = getMemberById_(data.paidByMemberId);
      if (!member) {
        throw new Error('NOT_FOUND: Paying member not found');
      }
    }

    // Validate category
    if (!data.category) {
      throw new Error('VALIDATION_ERROR: category is required');
    }

    const sheet = getSheet_('Expenses');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const expense = {
      expenseId: generateUUID_(),
      operationDate: operationDate,
      cycleKey: cycleKey,
      category: data.category,
      description: data.description || '',
      amount: amount,
      paidBy: data.paidBy,
      paidByMemberId: data.paidByMemberId || '',
      recurringExpenseId: '',
      isPlanned: false,
      notes: data.notes || '',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: user,
      updatedAt: now,
      updatedBy: user
    };

    appendRow_(sheet, expense, SHEET_DEFINITIONS.Expenses.headers);

    writeAuditLog_('CREATE', 'Expense', expense.expenseId, null, expense);

    return { expense };
  } finally {
    lock.releaseLock();
  }
}

function markPlannedExpensePaid_(data) {
  const lock = acquireLock_();

  try {
    if (!data.expenseId) {
      throw new Error('VALIDATION_ERROR: expenseId is required');
    }

    const expenses = getExpensesData_();
    const expense = expenses.find(e => e.expenseId === data.expenseId);

    if (!expense) {
      throw new Error('NOT_FOUND: Expense not found');
    }

    if (!expense.isPlanned) {
      throw new Error('VALIDATION_ERROR: This expense is not a planned item');
    }

    // Validate cycle is open
    const cycles = getCyclesData_();
    const cycle = cycles.find(c => c.cycleKey === expense.cycleKey);
    if (cycle && cycle.status === 'Closed') {
      throw new Error('CYCLE_CLOSED: Cannot modify expenses in closed cycle');
    }

    // Validate amount
    const amount = validateAmount_(parseFloat(data.amount));

    // Validate paidBy
    const validPaidBy = ['Treasury', 'Member'];
    if (!validPaidBy.includes(data.paidBy)) {
      throw new Error('VALIDATION_ERROR: paidBy must be Treasury or Member');
    }

    // Validate operation date
    const operationDate = data.operationDate || getTodayRiyadh_();
    validateOperationDate_(operationDate);

    const sheet = getSheet_('Expenses');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const before = { ...expense };
    const updates = {
      operationDate: operationDate,
      amount: amount,
      paidBy: data.paidBy,
      paidByMemberId: data.paidByMemberId || '',
      isPlanned: false,
      updatedAt: now,
      updatedBy: user
    };

    updateRow_(sheet, 'expenseId', data.expenseId, updates);

    writeAuditLog_('MARK_PAID', 'Expense', data.expenseId, before, updates);

    return { expense: { ...expense, ...updates } };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// RECURRING EXPENSES
// ============================================================================

function getRecurringExpenses_() {
  const recurringExpenses = getRecurringExpensesData_();
  return { recurringExpenses };
}

function createRecurringExpense_(data) {
  const lock = acquireLock_();

  try {
    // Validate type
    const validTypes = ['Fixed', 'Variable'];
    if (!validTypes.includes(data.type)) {
      throw new Error('VALIDATION_ERROR: type must be Fixed or Variable');
    }

    // Validate amount for Fixed
    let defaultAmount = null;
    if (data.type === 'Fixed') {
      if (data.defaultAmount === undefined || data.defaultAmount === null) {
        throw new Error('VALIDATION_ERROR: defaultAmount is required for Fixed type');
      }
      defaultAmount = validateAmount_(parseFloat(data.defaultAmount));
    }

    // Validate category
    if (!data.category) {
      throw new Error('VALIDATION_ERROR: category is required');
    }

    const sheet = getSheet_('Recurring_Expenses');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const recurringExpense = {
      recurringExpenseId: generateUUID_(),
      category: data.category,
      description: data.description || '',
      type: data.type,
      defaultAmount: defaultAmount || '',
      isActive: true,
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: user,
      updatedAt: now,
      updatedBy: user
    };

    appendRow_(sheet, recurringExpense, SHEET_DEFINITIONS.Recurring_Expenses.headers);

    writeAuditLog_('CREATE', 'RecurringExpense', recurringExpense.recurringExpenseId, null, recurringExpense);

    return { recurringExpense };
  } finally {
    lock.releaseLock();
  }
}

function updateRecurringExpense_(data) {
  const lock = acquireLock_();

  try {
    if (!data.recurringExpenseId) {
      throw new Error('VALIDATION_ERROR: recurringExpenseId is required');
    }

    const recurringExpenses = getRecurringExpensesData_();
    const recurring = recurringExpenses.find(r => r.recurringExpenseId === data.recurringExpenseId);

    if (!recurring) {
      throw new Error('NOT_FOUND: Recurring expense not found');
    }

    const sheet = getSheet_('Recurring_Expenses');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const before = { ...recurring };
    const updates = {
      updatedAt: now,
      updatedBy: user
    };

    // Update allowed fields
    if (data.description !== undefined) updates.description = data.description;
    if (data.defaultAmount !== undefined) {
      updates.defaultAmount = data.type === 'Fixed' ? validateAmount_(parseFloat(data.defaultAmount)) : '';
    }
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    updateRow_(sheet, 'recurringExpenseId', data.recurringExpenseId, updates);

    writeAuditLog_('UPDATE', 'RecurringExpense', data.recurringExpenseId, before, updates);

    return { recurringExpense: { ...recurring, ...updates } };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// ADJUSTMENTS
// ============================================================================

function getAdjustments_(cycleKey) {
  let adjustments = getAdjustmentsData_();

  if (cycleKey) {
    adjustments = adjustments.filter(a => a.cycleKey === cycleKey);
  }

  const members = getMembersData_();
  const membersMap = {};
  members.forEach(m => membersMap[m.memberId] = m.displayName);

  return {
    adjustments: adjustments.map(a => ({
      ...a,
      memberName: a.memberId ? membersMap[a.memberId] : null,
      cycleName: getCycleNameFromKey_(a.cycleKey)
    }))
  };
}

function createAdjustment_(data) {
  const lock = acquireLock_();

  try {
    // Validate amount (can be positive or negative)
    const amount = roundToTwoDecimals_(parseFloat(data.amount));
    if (isNaN(amount)) {
      throw new Error('INVALID_AMOUNT: Amount must be a number');
    }

    // Validate reason
    if (!data.reason || !data.reason.trim()) {
      throw new Error('VALIDATION_ERROR: reason is required');
    }

    // Validate and get operation date
    const operationDate = data.operationDate || getTodayRiyadh_();
    const cycleKey = validateOperationDate_(operationDate);

    // Validate entityType
    const validEntityTypes = ['Payment', 'Expense', 'Due', 'Settlement', 'OpeningBalance', 'Other'];
    if (!validEntityTypes.includes(data.entityType)) {
      throw new Error('VALIDATION_ERROR: entityType must be one of: ' + validEntityTypes.join(', '));
    }

    // Validate member if provided
    if (data.memberId) {
      const member = getMemberById_(data.memberId);
      if (!member) {
        throw new Error('NOT_FOUND: Member not found');
      }
    }

    const sheet = getSheet_('Adjustments');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const adjustment = {
      adjustmentId: generateUUID_(),
      operationDate: operationDate,
      cycleKey: cycleKey,
      entityType: data.entityType,
      entityId: data.entityId || '',
      memberId: data.memberId || '',
      amount: amount,
      reason: data.reason.trim(),
      notes: data.notes || '',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: user
    };

    appendRow_(sheet, adjustment, SHEET_DEFINITIONS.Adjustments.headers);

    writeAuditLog_('CREATE', 'Adjustment', adjustment.adjustmentId, null, adjustment);

    // Update member status if needed
    if (data.memberId) {
      updateMemberStatusIfNeeded_(data.memberId);
    }

    return { adjustment };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// SETTLEMENTS
// ============================================================================

function getSettlements_(cycleKey) {
  let settlements = getSettlementsData_();

  if (cycleKey) {
    settlements = settlements.filter(s => s.cycleKey === cycleKey);
  }

  const members = getMembersData_();
  const membersMap = {};
  members.forEach(m => membersMap[m.memberId] = m.displayName);

  return {
    settlements: settlements.map(s => ({
      ...s,
      memberName: membersMap[s.memberId],
      cycleName: getCycleNameFromKey_(s.cycleKey)
    }))
  };
}

function createSettlement_(data) {
  const lock = acquireLock_();

  try {
    // Validate member
    if (!data.memberId) {
      throw new Error('VALIDATION_ERROR: memberId is required');
    }

    const member = getMemberById_(data.memberId);
    if (!member) {
      throw new Error('NOT_FOUND: Member not found');
    }

    // Check member has credit (negative effective balance)
    const balances = calculateAllMemberBalances_();
    const balance = balances[data.memberId];

    if (!balance || balance.effectiveBalance >= 0) {
      throw new Error('VALIDATION_ERROR: Member does not have credit to settle');
    }

    // Validate amount
    const amount = validateAmount_(parseFloat(data.amount));

    // Amount cannot exceed credit
    const maxSettlement = Math.abs(balance.effectiveBalance);
    if (amount > maxSettlement) {
      throw new Error('VALIDATION_ERROR: Settlement amount cannot exceed member credit of ' + maxSettlement + ' SAR');
    }

    // Validate and get operation date
    const operationDate = data.operationDate || getTodayRiyadh_();
    const cycleKey = validateOperationDate_(operationDate);

    const sheet = getSheet_('Settlements');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const settlement = {
      settlementId: generateUUID_(),
      memberId: data.memberId,
      operationDate: operationDate,
      cycleKey: cycleKey,
      amount: amount,
      method: 'Cash',
      notes: data.notes || '',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: user
    };

    appendRow_(sheet, settlement, SHEET_DEFINITIONS.Settlements.headers);

    writeAuditLog_('CREATE', 'Settlement', settlement.settlementId, null, settlement);

    return { settlement };
  } finally {
    lock.releaseLock();
  }
}
