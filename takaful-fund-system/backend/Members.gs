/**
 * إدارة الأعضاء
 * إنشاء وتعديل وإدارة حالات الأعضاء
 */

function getMembers_() {
  const sheet = getSheet_('Members');
  const members = sheetDataToObjects_(sheet);
  return members.map(function(m) {
    return {
      memberId: m.memberId,
      displayName: m.displayName,
      joinDate: m.joinDate,
      status: m.status,
      phone: m.phone || '',
      email: m.email || '',
      notes: m.notes || '',
      createdAt: m.createdAt,
      updatedAt: m.updatedAt || ''
    };
  });
}

function getMembersData_() {
  const sheet = getSheet_('Members');
  return sheetDataToObjects_(sheet);
}

function createMember_(data) {
  if (!data.displayName || !String(data.displayName).trim()) {
    throw new Error('VALIDATION_ERROR: اسم العضو مطلوب');
  }

  const lock = acquireLock_();
  try {
    const sheet = getSheet_('Members');
    const members = sheetDataToObjects_(sheet);
    const name = String(data.displayName).trim();

    // التحقق من عدم تكرار الاسم
    const duplicate = members.find(function(m) {
      return m.displayName.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
      throw new Error('DUPLICATE_NAME: يوجد عضو بنفس الاسم "' + name + '" مسبقاً');
    }

    const memberId = Utilities.getUuid();
    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';
    const joinDate = data.joinDate || getTodayRiyadh_();

    if (data.joinDate) {
      validateDate_(data.joinDate);
    }

    const newMember = [
      memberId,
      name,
      joinDate,
      'نشط',
      data.phone || '',
      data.email || '',
      data.notes || '',
      now,
      user,
      now,
      user
    ];

    sheet.appendRow(newMember);

    writeAuditLog_('CREATE_MEMBER', 'Member', memberId, null, {
      memberId: memberId,
      displayName: name,
      joinDate: joinDate,
      status: 'نشط'
    }, null);

    return {
      memberId: memberId,
      displayName: name,
      message: 'تم إضافة العضو "' + name + '" بنجاح'
    };
  } finally {
    lock.releaseLock();
  }
}

function updateMember_(data) {
  if (!data.memberId) {
    throw new Error('VALIDATION_ERROR: معرف العضو مطلوب');
  }

  const lock = acquireLock_();
  try {
    const sheet = getSheet_('Members');
    const rowIndex = findRowIndex_(sheet, 0, data.memberId);
    if (rowIndex === -1) {
      throw new Error('NOT_FOUND: العضو غير موجود');
    }

    const members = sheetDataToObjects_(sheet);
    const member = members.find(function(m) { return m.memberId === data.memberId; });
    const beforeState = JSON.parse(JSON.stringify(member));

    // التحقق من عدم تكرار الاسم الجديد
    if (data.displayName && String(data.displayName).trim() !== member.displayName) {
      const newName = String(data.displayName).trim();
      const duplicate = members.find(function(m) {
        return m.memberId !== data.memberId &&
               m.displayName.toLowerCase() === newName.toLowerCase();
      });
      if (duplicate) {
        throw new Error('DUPLICATE_NAME: يوجد عضو بنفس الاسم "' + newName + '" مسبقاً');
      }
    }

    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];

    // تحديث الحقول المسموح بها
    const updatableFields = ['displayName', 'phone', 'email', 'notes'];
    for (const field of updatableFields) {
      if (data[field] !== undefined) {
        const colIndex = headers.indexOf(field);
        if (colIndex !== -1) {
          rowData[colIndex] = field === 'displayName' ? String(data[field]).trim() : data[field];
        }
      }
    }

    // تحديث وقت التعديل
    const updatedAtCol = headers.indexOf('updatedAt');
    const updatedByCol = headers.indexOf('updatedBy');
    if (updatedAtCol !== -1) rowData[updatedAtCol] = now;
    if (updatedByCol !== -1) rowData[updatedByCol] = user;

    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);

    writeAuditLog_('UPDATE_MEMBER', 'Member', data.memberId, beforeState, {
      displayName: rowData[headers.indexOf('displayName')],
      phone: rowData[headers.indexOf('phone')],
      email: rowData[headers.indexOf('email')],
      notes: rowData[headers.indexOf('notes')]
    }, null);

    return { message: 'تم تحديث بيانات العضو بنجاح' };
  } finally {
    lock.releaseLock();
  }
}

function markMemberInactive_(data) {
  if (!data.memberId) {
    throw new Error('VALIDATION_ERROR: معرف العضو مطلوب');
  }

  const lock = acquireLock_();
  try {
    const sheet = getSheet_('Members');
    const rowIndex = findRowIndex_(sheet, 0, data.memberId);
    if (rowIndex === -1) {
      throw new Error('NOT_FOUND: العضو غير موجود');
    }

    const members = sheetDataToObjects_(sheet);
    const member = members.find(function(m) { return m.memberId === data.memberId; });

    if (member.status === 'غير نشط' || member.status === 'مغلق') {
      throw new Error('VALIDATION_ERROR: العضو ليس نشطاً بالفعل');
    }

    const now = getNowRiyadh_();
    const user = Session.getActiveUser().getEmail() || 'النظام';
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];

    // تحديد الحالة الجديدة
    const balances = calculateAllMemberBalances_();
    const memberBalance = balances.find(function(b) { return b.memberId === data.memberId; });
    const netBalance = memberBalance ? memberBalance.netBalance : 0;

    // إذا كان للعضو رصيد دائن (الصندوق مدين له) نضعه "غير نشط"
    // إذا كان رصيده صفر نضعه "مغلق"
    const newStatus = netBalance !== 0 ? 'غير نشط' : 'مغلق';

    rowData[headers.indexOf('status')] = newStatus;
    rowData[headers.indexOf('updatedAt')] = now;
    rowData[headers.indexOf('updatedBy')] = user;

    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);

    writeAuditLog_('MEMBER_STATUS_CHANGE', 'Member', data.memberId,
      { status: 'نشط' },
      { status: newStatus, netBalance: netBalance },
      { reason: data.reason || '' }
    );

    return {
      message: 'تم تغيير حالة العضو إلى "' + newStatus + '"',
      newStatus: newStatus
    };
  } finally {
    lock.releaseLock();
  }
}
