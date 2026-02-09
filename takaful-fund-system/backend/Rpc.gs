/**
 * مساعد الاستدعاء الداخلي
 * يتيح استدعاء الدوال من الواجهة الأمامية عبر google.script.run
 */

function rpc(action, data) {
  return JSON.parse(handleApiRequest_(action, data || {}, 'POST').getContent());
}
