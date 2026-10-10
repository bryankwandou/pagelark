// Draws a made-up letter the way a phone would photograph it: warm tint,
// a soft shadow from the hand, light falloff toward one corner. The landing
// page then runs the real "printable" filter on it in the visitor's browser.

export function drawDemoPhoto(w = 900, h = 1200): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, w, h);

  // letterhead
  g.strokeStyle = '#1f2a44';
  g.lineWidth = 3;
  g.strokeRect(60, 60, w - 120, 150);
  g.fillStyle = '#2d55c8';
  g.beginPath();
  g.arc(140, 135, 50, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f5d33b';
  g.fillRect(122, 105, 36, 60);
  g.fillStyle = '#1f2a44';
  g.font = 'bold 40px Georgia, serif';
  g.fillText('NORTHFIELD COLLEGE', 220, 125);
  g.font = '22px Arial, sans-serif';
  g.fillText('Department of Information Systems', 220, 165);

  g.font = '22px Arial, sans-serif';
  const lines = [
    'Ref    : 014/IS/2026',
    'Subject: Internship supervisor letter',
    '',
    'Dear Ms. Rivera,',
    '',
    'We are pleased to confirm that you will act as',
    'campus supervisor for the student listed below',
    'during the autumn internship programme.',
    '',
    'Name      : Alex Morgan',
    'Student ID: 0000000',
    'Company   : Example Labs Ltd.',
    '',
    'Thank you for your time and support.',
  ];
  lines.forEach((l, i) => g.fillText(l, 110, 290 + i * 40));

  // blue stamp + signature
  g.strokeStyle = 'rgba(40,90,200,.75)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(w - 250, h - 260, 75, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(w - 250, h - 260, 58, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#151515';
  g.lineWidth = 3.5;
  g.beginPath();
  g.moveTo(w - 360, h - 230);
  g.bezierCurveTo(w - 320, h - 330, w - 290, h - 170, w - 250, h - 260);
  g.bezierCurveTo(w - 220, h - 320, w - 180, h - 210, w - 140, h - 270);
  g.stroke();
  g.fillStyle = '#151515';
  g.font = 'bold 20px Arial, sans-serif';
  g.fillText('Head of Department', w - 360, h - 150);

  // uneven light: dark corner and a hand shadow
  const v = g.createRadialGradient(w * 0.35, h * 0.3, h * 0.1, w * 0.5, h * 0.6, h * 0.9);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(40,30,10,.42)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  const s = g.createLinearGradient(w, h * 0.55, w * 0.55, h);
  s.addColorStop(0, 'rgba(0,0,0,.30)');
  s.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.fillStyle = s;
  g.fillRect(0, 0, w, h);
  return c;
}
