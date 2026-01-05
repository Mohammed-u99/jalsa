/**
 * Majlis Fund System - Members Management
 */

// ============================================================================
// MEMBER DATA ACCESS
// ============================================================================

/**
 * Gets all members data (raw)
 */
function getMembersData_() {
  const sheet = getSheet_('Members');
  return sheetDataToObjects_(sheet);
}

/**
 * Gets members with calculated balances for API
 */
function getMembers_() {
  const members = getMembersData_();
  const balances = calculateAllMemberBalances_();

  return {
    members: members.map(m => {
      const balance = balances[m.memberId] || {
        effectiveBalance: 0,
        pendingCredit: 0,
        activeCredit: 0
      };

      return {
        ...m,
        effectiveBalance: balance.effectiveBalance,
        pendingCredit: balance.pendingCredit,
        activeCredit: balance.activeCredit
      };
    })
  };
}

/**
 * Gets a member by ID
 */
function getMemberById_(memberId) {
  const members = getMembersData_();
  return members.find(m => m.memberId === memberId);
}

/**
 * Gets a member by display name
 */
function getMemberByName_(displayName) {
  const members = getMembersData_();
  return members.find(m => m.displayName.toLowerCase() === displayName.toLowerCase());
}

// ============================================================================
// MEMBER OPERATIONS
// ============================================================================

/**
 * Creates a new member
 */
function createMember_(data) {
  const lock = acquireLock_();

  try {
    // Validate required fields
    if (!data.displayName || !data.displayName.trim()) {
      throw new Error('VALIDATION_ERROR: displayName is required');
    }

    const displayName = data.displayName.trim();

    // Check unique name
    const existing = getMemberByName_(displayName);
    if (existing) {
      throw new Error('DUPLICATE_NAME: A member with this name already exists');
    }

    // Validate start cycle
    const startCycle = data.startCycle || getCycleKeyFromDate_(getTodayRiyadh_());
    if (startCycle < CONFIG.SYSTEM_START_CYCLE) {
      throw new Error('VALIDATION_ERROR: startCycle cannot be before system start');
    }

    const sheet = getSheet_('Members');
    const now = getNowRiyadh_();
    const user = getCurrentUserEmail_();

    const member = {
      memberId: generateUUID_(),
      displayName: displayName,
      startCycle: startCycle,
      endCycle: '',
      status: 'Active',
      phone: data.phone || '',
      email: data.email || '',
      notes: data.notes || '',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      createdAt: now,
      createdBy: user,
      updatedAt: now,
      updatedBy: user
    };

    appendRow_(sheet, member, SHEET_DEFINITIONS.Members.headers);

    // Generate due for current cycle if member starts in current or past cycle
    const currentCycleKey = getCycleKeyFromDate_(getTodayRiyadh_());
    if (startCycle <= currentCycleKey) {
      const cycles = getCyclesData_();
      const currentCycle = cycles.find(c => c.cycleKey === currentCycleKey);
      if (currentCycle && currentCycle.status === 'Open') {
        const dueAmount = currentCycle.dueAmountOverride || CONFIG.DEFAULT_DUE_AMOUNT;
        generateDuesForCycle_(currentCycleKey, [member], parseFloat(dueAmount));
      }
    }

    writeAuditLog_('CREATE', 'Member', member.memberId, null, member);

    return { member };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates a member (non-financial fields only)
 */
function updateMember_(data) {
  const lock = acquireLock_();

  try {
    if (!data.memberId) {
      throw new Error('VALIDATION_ERROR: memberId is required');
    }

    const member = getMemberById_(data.memberId);
    if (!member) {
      throw new Error('NOT_FOUND: Member not found');
    }

    // Can only update non-financial fields
    const allowedFields = ['phone', 'email', 'notes'];
    const updates = { updatedAt: getNowRiyadh_(), updatedBy: getCurrentUserEmail_() };
    const before = {};

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        before[field] = member[field];
        updates[field] = data[field];
      }
    }

    const sheet = getSheet_('Members');
    updateRow_(sheet, 'memberId', data.memberId, updates);

    writeAuditLog_('UPDATE', 'Member', data.memberId, before, updates);

    return { member: { ...member, ...updates } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Marks a member as left
 */
function markMemberLeft_(data) {
  const lock = acquireLock_();

  try {
    if (!data.memberId) {
      throw new Error('VALIDATION_ERROR: memberId is required');
    }

    const member = getMemberById_(data.memberId);
    if (!member) {
      throw new Error('NOT_FOUND: Member not found');
    }

    if (member.status !== 'Active') {
      throw new Error('VALIDATION_ERROR: Only active members can be marked as left');
    }

    // End cycle defaults to current cycle
    const endCycle = data.endCycle || getCycleKeyFromDate_(getTodayRiyadh_());

    // Calculate effective balance
    const balances = calculateAllMemberBalances_();
    const balance = balances[data.memberId] || { effectiveBalance: 0 };

    // Determine new status
    let newStatus;
    if (balance.effectiveBalance > 0) {
      newStatus = 'LeftOpenDebt';
    } else {
      newStatus = 'Closed';
    }

    const sheet = getSheet_('Members');
    const now = getNowRiyadh_();
    const updates = {
      endCycle: endCycle,
      status: newStatus,
      updatedAt: now,
      updatedBy: getCurrentUserEmail_()
    };

    updateRow_(sheet, 'memberId', data.memberId, updates);

    writeAuditLog_('MARK_LEFT', 'Member', data.memberId,
      { status: member.status, endCycle: member.endCycle },
      updates
    );

    return {
      member: { ...member, ...updates },
      effectiveBalance: balance.effectiveBalance
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Updates member status based on current balance (for LeftOpenDebt -> Closed transition)
 */
function updateMemberStatusIfNeeded_(memberId) {
  const member = getMemberById_(memberId);
  if (!member || member.status !== 'LeftOpenDebt') {
    return;
  }

  const balances = calculateAllMemberBalances_();
  const balance = balances[memberId] || { effectiveBalance: 0 };

  if (balance.effectiveBalance <= 0) {
    const sheet = getSheet_('Members');
    const now = getNowRiyadh_();
    const updates = {
      status: 'Closed',
      updatedAt: now,
      updatedBy: getCurrentUserEmail_()
    };

    updateRow_(sheet, 'memberId', memberId, updates);

    writeAuditLog_('STATUS_CHANGE', 'Member', memberId,
      { status: 'LeftOpenDebt' },
      { status: 'Closed', reason: 'Debt settled' }
    );
  }
}
