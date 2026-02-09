# عقد واجهة برمجة التطبيقات - صندوق التكافل

## نظرة عامة

جميع الطلبات تمر عبر `doGet` أو `doPost` في `Code.gs`.

### صيغة الطلب (POST)
```json
{
  "action": "اسم_الإجراء",
  "data": { ... }
}
```

### صيغة الاستجابة
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-01-15T10:30:00+03:00"
}
```

### صيغة الخطأ
```json
{
  "success": false,
  "data": null,
  "error": "رسالة الخطأ",
  "timestamp": "2025-01-15T10:30:00+03:00"
}
```

## نقاط النهاية

### النظام

#### `initializeSystem`
تهيئة النظام وإنشاء الأوراق المطلوبة.

**المدخلات:** لا شيء

**المخرجات:**
```json
{
  "message": "تم تهيئة النظام بنجاح",
  "sheetsCreated": ["Members", "Contributions"],
  "sheetsExisting": ["Settings"]
}
```

---

### الإعدادات

#### `getSettings`
جلب جميع الإعدادات.

**المخرجات:**
```json
{
  "schemaVersion": "1.0.0",
  "fundName": "صندوق التكافل",
  "openingTreasuryCash": "0",
  "currency": "ريال"
}
```

#### `updateSetting`
تحديث إعداد.

**المدخلات:**
```json
{
  "key": "fundName",
  "value": "صندوق الجلسة"
}
```

---

### الأعضاء

#### `getMembers`
جلب قائمة الأعضاء.

**المخرجات:**
```json
[
  {
    "memberId": "uuid",
    "displayName": "أحمد محمد",
    "joinDate": "2025-01-01",
    "status": "نشط",
    "phone": "0501234567",
    "email": "",
    "notes": ""
  }
]
```

#### `createMember`
إضافة عضو جديد.

**المدخلات:**
```json
{
  "displayName": "أحمد محمد",
  "joinDate": "2025-01-01",
  "phone": "0501234567",
  "email": "",
  "notes": ""
}
```

#### `updateMember`
تعديل بيانات عضو.

**المدخلات:**
```json
{
  "memberId": "uuid",
  "displayName": "أحمد محمد علي",
  "phone": "0509876543"
}
```

#### `markMemberInactive`
تغيير حالة العضو إلى غير نشط أو مغلق.

**المدخلات:**
```json
{
  "memberId": "uuid",
  "reason": "انسحاب من المجموعة"
}
```

---

### المساهمات

#### `getContributions`
جلب قائمة المساهمات.

**المخرجات:**
```json
[
  {
    "contributionId": "uuid",
    "memberId": "uuid",
    "memberName": "أحمد محمد",
    "operationDate": "2025-01-15",
    "amount": 200,
    "method": "نقدي",
    "bankName": "",
    "notes": ""
  }
]
```

#### `createContribution`
تسجيل مساهمة جديدة.

**المدخلات:**
```json
{
  "memberId": "uuid",
  "operationDate": "2025-01-15",
  "amount": 200,
  "method": "نقدي",
  "bankName": "",
  "notes": "مساهمة شهر يناير"
}
```

**طرق الدفع:** `نقدي` | `تحويل بنكي`

---

### المصروفات

#### `getExpenses`
جلب قائمة المصروفات.

#### `createExpense`
تسجيل مصروف جديد.

**المدخلات:**
```json
{
  "operationDate": "2025-01-20",
  "category": "طعام",
  "description": "عشاء الجلسة",
  "amount": 500,
  "paidBy": "الصندوق",
  "memberId": "",
  "notes": ""
}
```

**أنواع الدافع:** `الصندوق` | `عضو`

---

### التعديلات

#### `getAdjustments`
جلب قائمة التعديلات.

#### `createAdjustment`
تسجيل تعديل جديد.

**المدخلات:**
```json
{
  "operationDate": "2025-01-25",
  "entityType": "عضو",
  "memberId": "uuid",
  "amount": -50,
  "reason": "تصحيح مبلغ مساهمة سابقة"
}
```

**ملاحظة:** المبلغ الموجب = إضافة، السالب = خصم.

---

### التسويات

#### `getSettlements`
جلب قائمة التسويات.

#### `createSettlement`
تسجيل تسوية (استرداد مبلغ لعضو).

**المدخلات:**
```json
{
  "memberId": "uuid",
  "operationDate": "2025-02-01",
  "amount": 300,
  "reason": "استرداد رصيد متبقي"
}
```

---

### البنوك

#### `getBanks`
جلب قائمة البنوك.

#### `createBank`
إضافة بنك جديد.

**المدخلات:**
```json
{ "bankName": "الراجحي" }
```

---

### الفئات

#### `getCategories`
جلب قائمة فئات المصروفات.

#### `createCategory`
إضافة فئة جديدة.

**المدخلات:**
```json
{ "categoryName": "طعام" }
```

---

### سجل المراجعة

#### `getAuditLog`
جلب سجل المراجعة (الأحدث أولاً).

---

### التقارير

#### `getSnapshot`
جلب تقرير شامل مع إمكانية التصفية بالفترة.

**المدخلات:**
```json
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}
```

#### `getMemberLedger`
جلب سجل معاملات عضو محدد.

**المدخلات:**
```json
{ "memberId": "uuid" }
```

**المخرجات:**
```json
{
  "member": { "memberId": "uuid", "displayName": "أحمد", "status": "نشط" },
  "balance": { "totalContributions": 600, "netBalance": 550 },
  "ledger": [
    {
      "date": "2025-01-15",
      "type": "مساهمة",
      "description": "مساهمة - نقدي",
      "amount": 200,
      "runningBalance": 200
    }
  ]
}
```

---

## رموز الأخطاء

| الرمز | الوصف |
|------|------|
| `SETUP_REQUIRED` | لم يتم تعيين معرف جدول البيانات |
| `SHEET_NOT_FOUND` | الورقة غير موجودة (النظام غير مهيأ) |
| `LOCK_TIMEOUT` | النظام مشغول |
| `VALIDATION_ERROR` | خطأ في التحقق من البيانات |
| `INVALID_DATE` | تاريخ غير صحيح |
| `INVALID_AMOUNT` | مبلغ غير صحيح |
| `DUPLICATE_NAME` | اسم مكرر |
| `NOT_FOUND` | العنصر غير موجود |
