/**
 * Majlis Fund System - Cycle Engine
 * Handles cycle management, auto-close, and self-healing loop
 */

// ============================================================================
// CYCLE DATA ACCESS
// ============================================================================

/**
 * Gets all cycles data
 */
function getCyclesData_() {
  const sheet = getSheet_('Cycles');
  return sheetDataToObjects_(sheet);
}

/**
 * Gets cycles for API response
 */
function getCycles_() {
  const cycles = getCyclesData_();
  const currentCycleKey = getCycleKeyFromDate_(getTodayRiyadh_());

  // Sort by cycleKey
  cycles.sort((a, b) => compareCycleKeys_(a.cycleKey, b.cycleKey));

  // Find current cycle
  const currentCycle = cycles.find(c => c.cycleKey === currentCycleKey);

  return {
    cycles: cycles.map(c => ({
      ...c,
      paymentStatusSnapshot: c.paymentStatusSnapshot ? JSON.parse(c.paymentStatusSnapshot) : null
    })),
    currentCycle: currentCycle ? {
      cycleKey: currentCycle.cycleKey,
      cycleName: currentCycle.cycleName,
      status: currentCycle.status
    } : null
  };
}

// ============================================================================
// CYCLE CREATION AND MANAGEMENT
// ============================================================================

/**
 * Creates a new cycle
 */
function createCycle_(cycleKey, status = 'Open') {
  const sheet = getSheet_('Cycles');
  const existingCycles = getCyclesData_();

  // Check if already exists
  if (existingCycles.some(c => c.cycleKey === cycleKey)) {
    return existingCycles.find(c => c.cycleKey === cycleKey);
  }

  const now = getNowRiyadh_();
  const cycle = {
    cycleId: generateUUID_(),
    cycleKey: cycleKey,
    cycleName: getCycleNameFromKey_(cycleKey),
    startDate: getCycleStartDate_(cycleKey),
    endDate: getCycleEndDate_(cycleKey),
    status: status,
    dueAmountOverride: '',
    closedAt: '',
    paymentStatusSnapshot: '',
    schemaVersion: CONFIG.SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now
  };

  appendRow_(sheet, cycle, SHEET_DEFINITIONS.Cycles.headers);

  writeAuditLog_('CREATE', 'Cycle', cycle.cycleId, null, cycle);

  return cycle;
}

/**
 * Opens a cycle (generates dues and planned expenses)
 */
function openCycle_(cycleKey) {
  // Create the cycle if it doesn't exist
  const cycle = createCycle_(cycleKey, 'Open');

  // Get active members
  const members = getMembersData_();
  const activeMembers = members.filter(m => {
    if (m.status !== 'Active') return false;
    if (m.startCycle > cycleKey) return false;
    if (m.endCycle && m.endCycle < cycleKey) return false;
    return true;
  });

  // Generate dues for active members
  const dueAmount = cycle.dueAmountOverride || CONFIG.DEFAULT_DUE_AMOUNT;
  const duesGenerated = generateDuesForCycle_(cycleKey, activeMembers, parseFloat(dueAmount));

  // Generate planned expenses from recurring expenses
  const plannedExpenses = generatePlannedExpenses_(cycleKey);

  // Activate pending credits from previous cycle
  const creditsActivated = activatePendingCredits_(cycleKey);

  return {
    cycle: cycle,
    duesGenerated: duesGenerated,
    plannedExpenses: plannedExpenses,
    creditsActivated: creditsActivated
  };
}

/**
 * Closes a cycle (creates snapshot and marks as closed)
 */
function closeCycle_(cycleKey) {
  const lock = acquireLock_();

  try {
    const sheet = getSheet_('Cycles');
    const cycles = getCyclesData_();
    const cycle = cycles.find(c => c.cycleKey === cycleKey);

    if (!cycle) {
      throw new Error('Cycle not found: ' + cycleKey);
    }

    if (cycle.status === 'Closed') {
      return { alreadyClosed: true, cycle: cycle };
    }

    // Generate payment status snapshot
    const snapshot = generatePaymentStatusSnapshot_(cycleKey);

    // Update cycle
    const now = getNowRiyadh_();
    const updates = {
      status: 'Closed',
      closedAt: now,
      paymentStatusSnapshot: JSON.stringify(snapshot),
      updatedAt: now
    };

    updateRow_(sheet, 'cycleId', cycle.cycleId, updates);

    writeAuditLog_('CLOSE_CYCLE', 'Cycle', cycle.cycleId, { status: 'Open' }, { status: 'Closed', snapshot });

    return {
      alreadyClosed: false,
      cycle: { ...cycle, ...updates },
      snapshot: snapshot
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generates payment status snapshot for a cycle
 */
function generatePaymentStatusSnapshot_(cycleKey) {
  const members = getMembersData_();
  const dues = getDuesData_().filter(d => d.cycleKey === cycleKey);
  const payments = getPaymentsData_().filter(p => p.cycleKey === cycleKey);

  const snapshot = {};

  for (const due of dues) {
    const memberPayments = payments.filter(p => p.memberId === due.memberId);
    const totalPaid = memberPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const dueAmount = parseFloat(due.amount);

    if (totalPaid >= dueAmount) {
      snapshot[due.memberId] = 'Paid';
    } else if (totalPaid > 0) {
      snapshot[due.memberId] = 'PartiallyPaid';
    } else {
      snapshot[due.memberId] = 'Unpaid';
    }
  }

  return snapshot;
}

/**
 * Manual close cycle (fallback)
 */
function closeCycleManual_(cycleKey) {
  // Verify this cycle should be closed (it's the previous cycle and we're past day 27)
  const today = getTodayRiyadh_();
  const currentCycleKey = getCycleKeyFromDate_(today);

  if (cycleKey >= currentCycleKey) {
    throw new Error('Cannot manually close current or future cycle');
  }

  // Check if today is >= 27th (should be closed)
  const day = parseInt(today.split('-')[2], 10);
  if (day < 27 && cycleKey === getPreviousCycleKey_(currentCycleKey)) {
    throw new Error('Cannot close cycle before day 27');
  }

  return closeCycle_(cycleKey);
}

/**
 * Sets a cycle due amount override
 */
function setCycleOverride_(cycleKey, dueAmountOverride) {
  const lock = acquireLock_();

  try {
    const sheet = getSheet_('Cycles');
    const cycles = getCyclesData_();
    const cycle = cycles.find(c => c.cycleKey === cycleKey);

    // Check if cycle exists
    if (!cycle) {
      // Can set override for future cycle
      const today = getTodayRiyadh_();
      const currentCycleKey = getCycleKeyFromDate_(today);

      if (cycleKey < currentCycleKey) {
        throw new Error('Cannot set override for past cycle');
      }
    } else if (cycle.status === 'Closed') {
      throw new Error('Cannot set override for closed cycle');
    }

    // Check if cycle hasn't started yet (must be before day 27)
    const cycleStartDate = getCycleStartDate_(cycleKey);
    const today = getTodayRiyadh_();

    if (today >= cycleStartDate) {
      throw new Error('Cannot set override after cycle has started');
    }

    // Create cycle if needed and update
    if (!cycle) {
      const newCycle = createCycle_(cycleKey, 'Open');
      updateRow_(sheet, 'cycleId', newCycle.cycleId, {
        dueAmountOverride: dueAmountOverride,
        updatedAt: getNowRiyadh_()
      });
      return { ...newCycle, dueAmountOverride };
    }

    const before = { dueAmountOverride: cycle.dueAmountOverride };
    updateRow_(sheet, 'cycleId', cycle.cycleId, {
      dueAmountOverride: dueAmountOverride,
      updatedAt: getNowRiyadh_()
    });

    writeAuditLog_('UPDATE', 'Cycle', cycle.cycleId, before, { dueAmountOverride });

    return { ...cycle, dueAmountOverride };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// SELF-HEALING LOOP
// ============================================================================

/**
 * Ensures all cycles are current (public API version)
 */
function ensureCyclesCurrent_() {
  const lock = acquireLock_();

  try {
    return ensureCyclesCurrentInternal_();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Internal version (assumes lock is held)
 */
function ensureCyclesCurrentInternal_() {
  const today = getTodayRiyadh_();
  const currentCycleKey = getCycleKeyFromDate_(today);

  let cycles = getCyclesData_();
  const results = {
    cyclesCreated: 0,
    cyclesClosed: 0,
    duesGenerated: 0,
    plannedExpensesGenerated: 0,
    creditsActivated: 0
  };

  // If no cycles exist, create from system start
  if (cycles.length === 0) {
    let cycleKey = CONFIG.SYSTEM_START_CYCLE;

    while (compareCycleKeys_(cycleKey, currentCycleKey) <= 0) {
      const result = openCycle_(cycleKey);
      results.cyclesCreated++;
      results.duesGenerated += result.duesGenerated;
      results.plannedExpensesGenerated += result.plannedExpenses;
      results.creditsActivated += result.creditsActivated;

      // Close if not current cycle
      if (cycleKey !== currentCycleKey) {
        closeCycle_(cycleKey);
        results.cyclesClosed++;
      }

      cycleKey = getNextCycleKey_(cycleKey);
    }

    return results;
  }

  // Sort existing cycles
  cycles.sort((a, b) => compareCycleKeys_(a.cycleKey, b.cycleKey));

  // Find the last cycle
  const lastCycle = cycles[cycles.length - 1];
  let lastCycleKey = lastCycle.cycleKey;

  // Close any open cycles that should be closed
  for (const cycle of cycles) {
    if (cycle.status === 'Open' && cycle.cycleKey !== currentCycleKey) {
      // This cycle should be closed
      const closeResult = closeCycle_(cycle.cycleKey);
      if (!closeResult.alreadyClosed) {
        results.cyclesClosed++;
      }
    }
  }

  // Create missing cycles up to current
  let nextKey = getNextCycleKey_(lastCycleKey);

  while (compareCycleKeys_(nextKey, currentCycleKey) <= 0) {
    const result = openCycle_(nextKey);
    results.cyclesCreated++;
    results.duesGenerated += result.duesGenerated;
    results.plannedExpensesGenerated += result.plannedExpenses;
    results.creditsActivated += result.creditsActivated;

    // Close if not current cycle
    if (nextKey !== currentCycleKey) {
      closeCycle_(nextKey);
      results.cyclesClosed++;
    }

    nextKey = getNextCycleKey_(nextKey);
  }

  // Ensure current cycle is open
  cycles = getCyclesData_();
  const currentCycle = cycles.find(c => c.cycleKey === currentCycleKey);

  if (!currentCycle) {
    const result = openCycle_(currentCycleKey);
    results.cyclesCreated++;
    results.duesGenerated += result.duesGenerated;
    results.plannedExpensesGenerated += result.plannedExpenses;
    results.creditsActivated += result.creditsActivated;
  } else if (currentCycle.status === 'Closed') {
    // This shouldn't happen normally, but handle it
    const sheet = getSheet_('Cycles');
    updateRow_(sheet, 'cycleId', currentCycle.cycleId, {
      status: 'Open',
      closedAt: '',
      updatedAt: getNowRiyadh_()
    });
  }

  return results;
}

// ============================================================================
// DUES GENERATION
// ============================================================================

/**
 * Generates dues for a cycle
 */
function generateDuesForCycle_(cycleKey, members, amount) {
  const sheet = getSheet_('Dues');
  const existingDues = getDuesData_().filter(d => d.cycleKey === cycleKey);
  const now = getNowRiyadh_();
  let generated = 0;

  for (const member of members) {
    // Check if due already exists
    if (existingDues.some(d => d.memberId === member.memberId)) {
      continue;
    }

    const due = {
      dueId: generateUUID_(),
      memberId: member.memberId,
      cycleKey: cycleKey,
      amount: amount,
      generatedAt: now,
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now
    };

    appendRow_(sheet, due, SHEET_DEFINITIONS.Dues.headers);
    generated++;
  }

  return generated;
}

/**
 * Generates planned expenses from recurring expenses
 */
function generatePlannedExpenses_(cycleKey) {
  const sheet = getSheet_('Expenses');
  const recurringExpenses = getRecurringExpensesData_().filter(r => r.isActive);
  const existingExpenses = getExpensesData_().filter(e => e.cycleKey === cycleKey);
  const now = getNowRiyadh_();
  const cycleStartDate = getCycleStartDate_(cycleKey);
  let generated = 0;

  for (const recurring of recurringExpenses) {
    // Check if planned expense already exists for this recurring item
    if (existingExpenses.some(e => e.recurringExpenseId === recurring.recurringExpenseId)) {
      continue;
    }

    const expense = {
      expenseId: generateUUID_(),
      operationDate: cycleStartDate,
      cycleKey: cycleKey,
      category: recurring.category,
      description: recurring.description,
      amount: recurring.type === 'Fixed' ? recurring.defaultAmount : 0,
      paidBy: '',
      paidByMemberId: '',
      recurringExpenseId: recurring.recurringExpenseId,
      isPlanned: true,
      notes: recurring.type === 'Variable' ? 'Amount to be entered when paid' : '',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: 'SYSTEM',
      updatedAt: now,
      updatedBy: 'SYSTEM'
    };

    appendRow_(sheet, expense, SHEET_DEFINITIONS.Expenses.headers);
    generated++;
  }

  return generated;
}

/**
 * Activates pending credits from member-paid purchases in the previous cycle
 * (Pending credits become active at cycle start)
 */
function activatePendingCredits_(cycleKey) {
  // Pending credits from member-paid purchases in previous cycle
  // are automatically active for FIFO application in current cycle
  // This is handled in the ledger calculation, not stored separately
  return 0;
}
