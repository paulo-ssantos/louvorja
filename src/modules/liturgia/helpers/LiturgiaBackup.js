import $userdata from '@/helpers/UserData';

export function exportLj() {
  const days = $userdata.get('modules.liturgia.days') || [];
  const payload = {
    format: 'louvorja-liturgia',
    version: 1,
    exported_at: new Date().toISOString(),
    days,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'liturgia.lj';
  a.click();
  URL.revokeObjectURL(a.href);
}

export function parseLj(text) {
  const obj = JSON.parse(text);
  if (obj.format !== 'louvorja-liturgia' || !Array.isArray(obj.days)) throw new Error('invalid');
  return obj;
}
