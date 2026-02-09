/**
 * محرك الحسابات
 * حساب أرصدة الأعضاء ورصيد الصندوق والتقارير المالية
 *
 * في هذا النظام لا توجد مستحقات شهرية ثابتة
 * كل عضو يساهم بأي مبلغ وفي أي وقت
 * الرصيد = إجمالي المساهمات + التعديلات - التسويات
 */

function calculateMemberBalance_(memberId) {
  const contributions = sheetDataToObjects_(getSheet_('Contributions'));
  const adjustments = sheetDataToObjects_(getSheet_('Adjustments'));
  const settlements = sheetDataToObjects_(getSheet_('Settlements'));

  // إجمالي المساهمات
  const totalContributions = contributions
    .filter(function(c) { return c.memberId === memberId; })
    .reduce(function(sum, c) { return sum + Number(c.amount); }, 0);

  // إجمالي التعديلات
  const totalAdjustments = adjustments
    .filter(function(a) { return a.memberId === memberId; })
    .reduce(function(sum, a) { return sum + Number(a.amount); }, 0);

  // إجمالي التسويات (مبالغ مستردة)
  const totalSettlements = settlements
    .filter(function(s) { return s.memberId === memberId; })
    .reduce(function(sum, s) { return sum + Number(s.amount); }, 0);

  const netBalance = Math.round((totalContributions + totalAdjustments - totalSettlements) * 100) / 100;

  return {
    memberId: memberId,
    totalContributions: Math.round(totalContributions * 100) / 100,
    totalAdjustments: Math.round(totalAdjustments * 100) / 100,
    totalSettlements: Math.round(totalSettlements * 100) / 100,
    netBalance: netBalance
  };
}

function calculateAllMemberBalances_() {
  const members = sheetDataToObjects_(getSheet_('Members'));
  const contributions = sheetDataToObjects_(getSheet_('Contributions'));
  const adjustments = sheetDataToObjects_(getSheet_('Adjustments'));
  const settlements = sheetDataToObjects_(getSheet_('Settlements'));

  return members.map(function(member) {
    const totalContributions = contributions
      .filter(function(c) { return c.memberId === member.memberId; })
      .reduce(function(sum, c) { return sum + Number(c.amount); }, 0);

    const totalAdjustments = adjustments
      .filter(function(a) { return a.memberId === member.memberId; })
      .reduce(function(sum, a) { return sum + Number(a.amount); }, 0);

    const totalSettlements = settlements
      .filter(function(s) { return s.memberId === member.memberId; })
      .reduce(function(sum, s) { return sum + Number(s.amount); }, 0);

    const netBalance = Math.round((totalContributions + totalAdjustments - totalSettlements) * 100) / 100;

    // حساب عدد المساهمات وآخر مساهمة
    const memberContributions = contributions
      .filter(function(c) { return c.memberId === member.memberId; });

    const lastContribution = memberContributions.length > 0
      ? memberContributions.sort(function(a, b) {
          return String(b.operationDate).localeCompare(String(a.operationDate));
        })[0]
      : null;

    return {
      memberId: member.memberId,
      displayName: member.displayName,
      status: member.status,
      joinDate: member.joinDate,
      totalContributions: Math.round(totalContributions * 100) / 100,
      totalAdjustments: Math.round(totalAdjustments * 100) / 100,
      totalSettlements: Math.round(totalSettlements * 100) / 100,
      netBalance: netBalance,
      contributionCount: memberContributions.length,
      lastContributionDate: lastContribution ? lastContribution.operationDate : null,
      lastContributionAmount: lastContribution ? Number(lastContribution.amount) : null
    };
  });
}

function calculateTreasuryCashBalance_() {
  const settings = sheetDataToObjects_(getSheet_('Settings'));
  const openingSetting = settings.find(function(s) { return s.key === 'openingTreasuryCash'; });
  const openingBalance = openingSetting ? Number(openingSetting.value) : CONFIG.OPENING_TREASURY_CASH;

  const contributions = sheetDataToObjects_(getSheet_('Contributions'));
  const expenses = sheetDataToObjects_(getSheet_('Expenses'));
  const adjustments = sheetDataToObjects_(getSheet_('Adjustments'));
  const settlements = sheetDataToObjects_(getSheet_('Settlements'));

  // إجمالي المساهمات
  const totalContributions = contributions
    .reduce(function(sum, c) { return sum + Number(c.amount); }, 0);

  // مصروفات الصندوق فقط (ليس التي يدفعها الأعضاء)
  const totalTreasuryExpenses = expenses
    .filter(function(e) { return e.paidBy === 'الصندوق'; })
    .reduce(function(sum, e) { return sum + Number(e.amount); }, 0);

  // تعديلات الصندوق (بدون عضو محدد)
  const treasuryAdjustments = adjustments
    .filter(function(a) { return !a.memberId || a.memberId === ''; })
    .reduce(function(sum, a) { return sum + Number(a.amount); }, 0);

  // التسويات المدفوعة للأعضاء
  const totalSettlements = settlements
    .reduce(function(sum, s) { return sum + Number(s.amount); }, 0);

  const balance = openingBalance + totalContributions - totalTreasuryExpenses
                  + treasuryAdjustments - totalSettlements;

  return {
    openingBalance: Math.round(openingBalance * 100) / 100,
    totalContributions: Math.round(totalContributions * 100) / 100,
    totalTreasuryExpenses: Math.round(totalTreasuryExpenses * 100) / 100,
    treasuryAdjustments: Math.round(treasuryAdjustments * 100) / 100,
    totalSettlements: Math.round(totalSettlements * 100) / 100,
    currentBalance: Math.round(balance * 100) / 100
  };
}

function getMemberLedger_(data) {
  if (!data.memberId) {
    throw new Error('VALIDATION_ERROR: معرف العضو مطلوب');
  }

  const members = getMembersData_();
  const member = members.find(function(m) { return m.memberId === data.memberId; });
  if (!member) {
    throw new Error('NOT_FOUND: العضو غير موجود');
  }

  const contributions = sheetDataToObjects_(getSheet_('Contributions'))
    .filter(function(c) { return c.memberId === data.memberId; });
  const adjustments = sheetDataToObjects_(getSheet_('Adjustments'))
    .filter(function(a) { return a.memberId === data.memberId; });
  const settlements = sheetDataToObjects_(getSheet_('Settlements'))
    .filter(function(s) { return s.memberId === data.memberId; });

  // بناء سجل مرتب زمنياً
  const ledger = [];

  contributions.forEach(function(c) {
    ledger.push({
      date: c.operationDate,
      type: 'مساهمة',
      description: 'مساهمة - ' + (c.method === 'نقدي' ? 'نقدي' : 'تحويل بنكي' + (c.bankName ? ' (' + c.bankName + ')' : '')),
      amount: Number(c.amount),
      notes: c.notes || ''
    });
  });

  adjustments.forEach(function(a) {
    ledger.push({
      date: a.operationDate,
      type: 'تعديل',
      description: 'تعديل: ' + (a.reason || ''),
      amount: Number(a.amount),
      notes: a.reason || ''
    });
  });

  settlements.forEach(function(s) {
    ledger.push({
      date: s.operationDate,
      type: 'تسوية',
      description: 'تسوية: ' + (s.reason || ''),
      amount: -Number(s.amount),
      notes: s.reason || ''
    });
  });

  // ترتيب حسب التاريخ
  ledger.sort(function(a, b) {
    return String(a.date).localeCompare(String(b.date));
  });

  // حساب الرصيد التراكمي
  let runningBalance = 0;
  ledger.forEach(function(entry) {
    runningBalance += entry.amount;
    entry.runningBalance = Math.round(runningBalance * 100) / 100;
  });

  const balance = calculateMemberBalance_(data.memberId);

  return {
    member: {
      memberId: member.memberId,
      displayName: member.displayName,
      status: member.status,
      joinDate: member.joinDate
    },
    balance: balance,
    ledger: ledger
  };
}

function getSnapshot_(data) {
  const members = getMembers_();
  const balances = calculateAllMemberBalances_();
  const treasury = calculateTreasuryCashBalance_();
  const contributions = sheetDataToObjects_(getSheet_('Contributions'));
  const expenses = sheetDataToObjects_(getSheet_('Expenses'));

  // تصفية حسب الفترة إذا تم تحديدها
  let filteredContributions = contributions;
  let filteredExpenses = expenses;

  if (data && data.startDate) {
    filteredContributions = contributions.filter(function(c) {
      return String(c.operationDate) >= data.startDate;
    });
    filteredExpenses = expenses.filter(function(e) {
      return String(e.operationDate) >= data.startDate;
    });
  }
  if (data && data.endDate) {
    filteredContributions = filteredContributions.filter(function(c) {
      return String(c.operationDate) <= data.endDate;
    });
    filteredExpenses = filteredExpenses.filter(function(e) {
      return String(e.operationDate) <= data.endDate;
    });
  }

  // تلخيص المصروفات حسب الفئة
  const expensesByCategory = {};
  filteredExpenses.forEach(function(e) {
    const cat = e.category || 'أخرى';
    if (!expensesByCategory[cat]) {
      expensesByCategory[cat] = 0;
    }
    expensesByCategory[cat] += Number(e.amount);
  });

  // ملخص المساهمات الشهرية
  const contributionsByMonth = {};
  filteredContributions.forEach(function(c) {
    const month = String(c.operationDate).substring(0, 7); // YYYY-MM
    if (!contributionsByMonth[month]) {
      contributionsByMonth[month] = { count: 0, total: 0 };
    }
    contributionsByMonth[month].count++;
    contributionsByMonth[month].total += Number(c.amount);
  });

  return {
    treasury: treasury,
    members: members,
    balances: balances,
    periodContributions: filteredContributions.length,
    periodContributionsTotal: filteredContributions.reduce(function(s, c) { return s + Number(c.amount); }, 0),
    periodExpenses: filteredExpenses.length,
    periodExpensesTotal: filteredExpenses.reduce(function(s, e) { return s + Number(e.amount); }, 0),
    expensesByCategory: expensesByCategory,
    contributionsByMonth: contributionsByMonth
  };
}
