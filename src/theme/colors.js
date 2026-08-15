// نظام ألوان موحّد لكل شاشات التطبيق - عشان أي تغيير في هوية اللون الأساسي (مثلًا) يتعمل
// في مكان واحد بس بدل ما يتكرر يدويًا في كل ملف شاشة على حدة
export const COLORS = {
  primary: '#2F80ED',
  primaryDark: '#185FA5',
  black: '#111111',
  bg: '#F5F7FA',
  white: '#ffffff',
  border: '#ececec',
  gray: '#999999',
  grayLight: '#f0f0f0',
  textMuted: '#777777',

  successBg: '#e6f4ea',
  successText: '#1e7e34',
  dangerBg: '#fdecea',
  dangerText: '#9c0c23',
  warningBg: '#fff3e0',
  warningText: '#b46a00',
  infoBg: '#e8f0fe',
  infoText: '#1a56db'
};

// ظل كارت شغال بشكل صحيح على أندرويد (elevation) وعلى آيفون (shadow*) مع بعض - استخدمه
// بدل ما تكتب elevation لوحدها، عشان الكروت متبقاش مسطحة من غير ظل خالص على آيفون
export const CARD_SHADOW = {
  elevation: 2,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3
};
