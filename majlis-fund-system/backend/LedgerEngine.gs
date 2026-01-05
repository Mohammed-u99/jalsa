/**
 * Majlis Fund System - Ledger Engine
 * Handles FIFO calculations, member balances, and treasury calculations
 */

// ============================================================================
// MEMBER BALANCE CALCULATIONS
// ============================================================================

/**
 * Calculates all member balances using FIFO
 * Returns: { memberId: { effectiveBalance, pendingCredit, activeCredit, ... } }
 */
function calculateAllMemberBalances_() {
  const members = getMembersData_();
  const dues = getDuesData_();
  const payments = getPaymentsData_();
  const expenses = getExpensesData_();
  const adjustments = getAdjustmentsData_();
  const settlements = getSettlementsData_();
  const currentCycleKey = getCycleKeyFromDate_(getTodayRiyadh_());

  const balances = {};

  for (const member of members) {
    balances[member.memberId] = calculateMemberBalance_(
      member,
      dues.filter(d => d.memberId === member.memberId),
      payments.filter(p => p.memberId === member.memberId),
      expenses.filter(e => e.paidBy === 'Member' && e.paidByMemberId === member.memberId),
      adjustments.filter(a => a.memberId === member.memberId),
      settlements.filter(s => s.memberId === member.memberId),
      currentCycleKey
    );
  }

  return balances;
}

/**
 * Calculates a single member's balance using FIFO
 */
function calculateMemberBalance_(member, dues, payments, memberExpenses, adjustments, settlements, currentCycleKey) {
  // Sort dues by cycle (oldest first for FIFO)
  dues.sort((a, b) => compareCycleKeys_(a.cycleKey, b.cycleKey));

  // Sort payments by operationDate (oldest first)
  payments.sort((a, b) => a.operationDate.localeCompare(b.operationDate));

  // Calculate total dues
  const totalDues = dues.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  // Calculate total payments
  const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  // Calculate member-paid expenses (creates credit)
  // Pending credit: expenses in current cycle
  // Active credit: expenses in previous cycles
  let pendingCredit = 0;
  let activeCredit = 0;

  for (const expense of memberExpenses) {
    if (!expense.isPlanned) {
      const amount = parseFloat(expense.amount);
      if (expense.cycleKey === currentCycleKey) {
        pendingCredit += amount;
      } else {
        activeCredit += amount;
      }
    }
  }

  // Calculate adjustments
  let adjustmentTotal = 0;
  for (const adj of adjustments) {
    adjustmentTotal += parseFloat(adj.amount);
  }

  // Calculate settlements (treasury paid to member, reduces their credit)
  const totalSettlements = settlements.reduce((sum, s) => sum + parseFloat(s.amount), 0);

  // Effective Balance = Dues - Payments - ActiveCredit + Adjustments + Settlements
  // Positive = member owes; Negative = group owes member
  const effectiveBalance = roundToTwoDecimals_(
    totalDues - totalPayments - activeCredit + adjustmentTotal + totalSettlements
  );

  return {
    totalDues: roundToTwoDecimals_(totalDues),
    totalPayments: roundToTwoDecimals_(totalPayments),
    activeCredit: roundToTwoDecimals_(activeCredit),
    pendingCredit: roundToTwoDecimals_(pendingCredit),
    adjustments: roundToTwoDecimals_(adjustmentTotal),
    settlements: roundToTwoDecimals_(totalSettlements),
    effectiveBalance: effectiveBalance
  };
}

/**
 * Gets detailed member ledger with FIFO application
 */
function getMemberLedger_(memberId) {
  const member = getMemberById_(memberId);
  if (!member) {
    throw new Error('NOT_FOUND: Member not found');
  }

  const dues = getDuesData_().filter(d => d.memberId === memberId);
  const payments = getPaymentsData_().filter(p => p.memberId === memberId);
  const expenses = getExpensesData_().filter(e => e.paidBy === 'Member' && e.paidByMemberId === memberId && !e.isPlanned);
  const adjustments = getAdjustmentsData_().filter(a => a.memberId === memberId);
  const settlements = getSettlementsData_().filter(s => s.memberId === memberId);

  // Build ledger entries
  const ledger = [];
  let runningBalance = 0;

  // Combine all entries with dates
  const allEntries = [
    ...dues.map(d => ({
      date: getCycleStartDate_(d.cycleKey),
      type: 'Due',
      description: getCycleNameFromKey_(d.cycleKey) + ' due',
      debit: parseFloat(d.amount),
      credit: 0,
      cycleKey: d.cycleKey,
      id: d.dueId
    })),
    ...payments.map(p => ({
      date: p.operationDate,
      type: 'Payment',
      description: p.method + ' payment' + (p.notes ? ': ' + p.notes : ''),
      debit: 0,
      credit: parseFloat(p.amount),
      cycleKey: p.cycleKey,
      id: p.paymentId
    })),
    ...expenses.map(e => ({
      date: e.operationDate,
      type: 'MemberPurchase',
      description: e.category + ': ' + e.description + ' (credit)',
      debit: 0,
      credit: parseFloat(e.amount),
      cycleKey: e.cycleKey,
      id: e.expenseId
    })),
    ...adjustments.map(a => ({
      date: a.operationDate,
      type: 'Adjustment',
      description: a.reason,
      debit: parseFloat(a.amount) > 0 ? parseFloat(a.amount) : 0,
      credit: parseFloat(a.amount) < 0 ? Math.abs(parseFloat(a.amount)) : 0,
      cycleKey: a.cycleKey,
      id: a.adjustmentId
    })),
    ...settlements.map(s => ({
      date: s.operationDate,
      type: 'Settlement',
      description: 'Reimbursement to member',
      debit: parseFloat(s.amount),
      credit: 0,
      cycleKey: s.cycleKey,
      id: s.settlementId
    }))
  ];

  // Sort by date
  allEntries.sort((a, b) => a.date.localeCompare(b.date));

  // Calculate running balance
  for (const entry of allEntries) {
    runningBalance = roundToTwoDecimals_(runningBalance + entry.debit - entry.credit);
    ledger.push({
      ...entry,
      balance: runningBalance
    });
  }

  return {
    member: member,
    ledger: ledger,
    currentBalance: runningBalance
  };
}

// ============================================================================
// TREASURY CALCULATIONS
// ============================================================================

/**
 * Calculates treasury cash balance
 */
function calculateTreasuryCashBalance_() {
  const adjustments = getAdjustmentsData_();
  const payments = getPaymentsData_();
  const expenses = getExpensesData_();
  const settlements = getSettlementsData_();

  // Opening balance from adjustments
  let openingBalance = 0;
  for (const adj of adjustments) {
    if (adj.entityType === 'OpeningBalance') {
      openingBalance += parseFloat(adj.amount);
    }
  }

  // Member payments (inflow)
  const totalPayments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  // Treasury-paid expenses (outflow)
  const treasuryExpenses = expenses
    .filter(e => e.paidBy === 'Treasury' && !e.isPlanned)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // Settlements/reimbursements (outflow)
  const totalSettlements = settlements.reduce((sum, s) => sum + parseFloat(s.amount), 0);

  // Other cash adjustments
  let cashAdjustments = 0;
  for (const adj of adjustments) {
    if (adj.entityType !== 'OpeningBalance' && adj.entityType !== 'Due') {
      // Cash-affecting adjustments
      cashAdjustments += parseFloat(adj.amount);
    }
  }

  return roundToTwoDecimals_(
    openingBalance + totalPayments - treasuryExpenses - totalSettlements + cashAdjustments
  );
}

/**
 * Calculates net cash flow for a cycle range
 */
function calculateNetCashFlow_(startCycle, endCycle) {
  const payments = getPaymentsData_();
  const expenses = getExpensesData_();
  const settlements = getSettlementsData_();

  // Filter by cycle range
  const filteredPayments = payments.filter(p =>
    p.cycleKey >= startCycle && p.cycleKey <= endCycle
  );
  const filteredExpenses = expenses.filter(e =>
    e.cycleKey >= startCycle && e.cycleKey <= endCycle && e.paidBy === 'Treasury' && !e.isPlanned
  );
  const filteredSettlements = settlements.filter(s =>
    s.cycleKey >= startCycle && s.cycleKey <= endCycle
  );

  const inflows = filteredPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const expenseOutflows = filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const settlementOutflows = filteredSettlements.reduce((sum, s) => sum + parseFloat(s.amount), 0);

  return {
    inflows: roundToTwoDecimals_(inflows),
    expenseOutflows: roundToTwoDecimals_(expenseOutflows),
    settlementOutflows: roundToTwoDecimals_(settlementOutflows),
    netCashFlow: roundToTwoDecimals_(inflows - expenseOutflows - settlementOutflows)
  };
}

// ============================================================================
// SNAPSHOT FOR DASHBOARD/REPORTS
// ============================================================================

/**
 * Gets comprehensive snapshot for dashboard and reports
 */
function getSnapshot_(startCycle, endCycle) {
  // Default to current cycle if not specified
  const currentCycleKey = getCycleKeyFromDate_(getTodayRiyadh_());
  startCycle = startCycle || CONFIG.SYSTEM_START_CYCLE;
  endCycle = endCycle || currentCycleKey;

  const cycles = getCyclesData_().filter(c =>
    c.cycleKey >= startCycle && c.cycleKey <= endCycle
  ).sort((a, b) => compareCycleKeys_(a.cycleKey, b.cycleKey));

  const members = getMembersData_();
  const dues = getDuesData_().filter(d => d.cycleKey >= startCycle && d.cycleKey <= endCycle);
  const payments = getPaymentsData_().filter(p => p.cycleKey >= startCycle && p.cycleKey <= endCycle);
  const expenses = getExpensesData_().filter(e => e.cycleKey >= startCycle && e.cycleKey <= endCycle);
  const adjustments = getAdjustmentsData_().filter(a => a.cycleKey >= startCycle && a.cycleKey <= endCycle);
  const settlements = getSettlementsData_().filter(s => s.cycleKey >= startCycle && s.cycleKey <= endCycle);

  // Calculate treasury balance
  const treasuryCashBalance = calculateTreasuryCashBalance_();

  // Calculate cash flow for range
  const cashFlow = calculateNetCashFlow_(startCycle, endCycle);

  // Calculate total expenses
  const totalExpenses = expenses
    .filter(e => !e.isPlanned)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const treasuryCashExpenses = expenses
    .filter(e => e.paidBy === 'Treasury' && !e.isPlanned)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0);

  // Calculate member balances
  const balances = calculateAllMemberBalances_();
  let totalOutstanding = 0;
  let totalCredits = 0;
  let pendingCredits = 0;

  for (const memberId in balances) {
    const balance = balances[memberId];
    if (balance.effectiveBalance > 0) {
      totalOutstanding += balance.effectiveBalance;
    } else {
      totalCredits += Math.abs(balance.effectiveBalance);
    }
    pendingCredits += balance.pendingCredit;
  }

  // Generate alerts
  const alerts = {
    negativeCash: treasuryCashBalance < 0,
    overdueMembers: [],
    leftOpenDebtMembers: [],
    unpaidPlannedItems: [],
    pendingSettlements: []
  };

  // Check for overdue members
  for (const memberId in balances) {
    const member = members.find(m => m.memberId === memberId);
    if (member && member.status === 'Active' && balances[memberId].effectiveBalance > 0) {
      // Check if any dues are from past cycles
      const memberDues = dues.filter(d => d.memberId === memberId);
      const memberPayments = payments.filter(p => p.memberId === memberId);
      const totalPaid = memberPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const totalDue = memberDues.reduce((sum, d) => sum + parseFloat(d.amount), 0);

      if (totalPaid < totalDue) {
        alerts.overdueMembers.push(memberId);
      }
    }

    if (member && member.status === 'LeftOpenDebt') {
      alerts.leftOpenDebtMembers.push(memberId);
    }

    if (member && balances[memberId].effectiveBalance < 0) {
      alerts.pendingSettlements.push({
        memberId: memberId,
        amount: Math.abs(balances[memberId].effectiveBalance)
      });
    }
  }

  // Check for unpaid planned items
  const plannedExpenses = expenses.filter(e => e.isPlanned && e.cycleKey <= currentCycleKey);
  alerts.unpaidPlannedItems = plannedExpenses.map(e => e.expenseId);

  // Build member balances array
  const memberBalances = members.map(m => {
    const balance = balances[m.memberId] || {
      totalDues: 0,
      totalPayments: 0,
      activeCredit: 0,
      pendingCredit: 0,
      adjustments: 0,
      settlements: 0,
      effectiveBalance: 0
    };

    return {
      memberId: m.memberId,
      displayName: m.displayName,
      status: m.status,
      ...balance
    };
  });

  // Add member names to data
  const membersMap = {};
  members.forEach(m => membersMap[m.memberId] = m.displayName);

  return {
    cycles: cycles.map(c => ({
      ...c,
      paymentStatusSnapshot: c.paymentStatusSnapshot ? JSON.parse(c.paymentStatusSnapshot) : null
    })),
    members: members,
    dues: dues.map(d => ({
      ...d,
      memberName: membersMap[d.memberId],
      cycleName: getCycleNameFromKey_(d.cycleKey)
    })),
    payments: payments.map(p => ({
      ...p,
      memberName: membersMap[p.memberId],
      cycleName: getCycleNameFromKey_(p.cycleKey)
    })),
    expenses: expenses.map(e => ({
      ...e,
      paidByMemberName: e.paidByMemberId ? membersMap[e.paidByMemberId] : null,
      cycleName: getCycleNameFromKey_(e.cycleKey)
    })),
    adjustments: adjustments.map(a => ({
      ...a,
      memberName: a.memberId ? membersMap[a.memberId] : null,
      cycleName: getCycleNameFromKey_(a.cycleKey)
    })),
    settlements: settlements.map(s => ({
      ...s,
      memberName: membersMap[s.memberId],
      cycleName: getCycleNameFromKey_(s.cycleKey)
    })),
    summary: {
      treasuryCashBalance: roundToTwoDecimals_(treasuryCashBalance),
      netCashFlow: cashFlow.netCashFlow,
      totalInflows: cashFlow.inflows,
      totalExpenseOutflows: cashFlow.expenseOutflows,
      totalSettlementOutflows: cashFlow.settlementOutflows,
      totalExpenses: roundToTwoDecimals_(totalExpenses),
      treasuryCashExpenses: roundToTwoDecimals_(treasuryCashExpenses),
      totalOutstanding: roundToTwoDecimals_(totalOutstanding),
      totalCredits: roundToTwoDecimals_(totalCredits),
      pendingCredits: roundToTwoDecimals_(pendingCredits)
    },
    memberBalances: memberBalances,
    alerts: alerts
  };
}
