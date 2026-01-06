function rpc(action, data) {
  const e = { postData: { contents: JSON.stringify({ action, data }) } };
  const out = doPost(e);            // يستعمل الراوتر الحالي
  const json = out.getContent();    // TextOutput -> string JSON
  return JSON.parse(json);          // يرجع Object عادي للواجهة
}
