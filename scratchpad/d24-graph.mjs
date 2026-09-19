import { chromium } from '<yerel-yol>
import { readFileSync } from 'node:fs';

const load = (l) => JSON.parse(readFileSync(`series-${l}.json`, 'utf8')).map((r) => ({ t: r.t, y: r.fpHeadYaw1 }));
const before = load('before').filter((r) => r.t >= 1000 && r.t <= 3500);
const after = load('after').filter((r) => r.t >= 1000 && r.t <= 3500);
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#12110f;color:#e9e2d4;font:13px/1.4 -apple-system,system-ui,sans-serif}
.wrap{padding:14px 18px}h1{font-size:15px;margin:0 0 2px}p{margin:0 0 8px;color:#a79f8d}
b.a{color:#e4b363}b.b{color:#6fb3c9}
</style><div class="wrap"><h1>D24 — uzak baş yaw'ı, 540 ms örnek aralığı, 60 fps</h1>
<p><b class="a">önce</b>: son örneğe koşma (basamak) &nbsp;·&nbsp; <b class="b">sonra</b>: tampon + ara değer &nbsp;·&nbsp; 2,5 s pencere</p>
<canvas id="c" width="900" height="380"></canvas></div>
<script>
const before=${JSON.stringify(before)},after=${JSON.stringify(after)};
const c=document.getElementById('c'),x=c.getContext('2d');
const t0=1000,t1=3500,pad=38;
const X=t=>pad+(t-t0)/(t1-t0)*(c.width-pad-14);
const Y=v=>c.height/2-v*(c.height/2-24)/0.5;
x.fillStyle='#12110f';x.fillRect(0,0,c.width,c.height);
x.strokeStyle='#2e2b25';x.lineWidth=1;
for(let v=-0.5;v<=0.5001;v+=0.25){x.beginPath();x.moveTo(pad,Y(v));x.lineTo(c.width-14,Y(v));x.stroke();
 x.fillStyle='#6d675b';x.fillText(v.toFixed(2),4,Y(v)+4);}
for(let t=t0;t<=t1;t+=540){x.strokeStyle='#211f1a';x.beginPath();x.moveTo(X(t),10);x.lineTo(X(t),c.height-10);x.stroke();}
const draw=(rows,col)=>{x.strokeStyle=col;x.lineWidth=2;x.beginPath();rows.forEach((r,i)=>i?x.lineTo(X(r.t),Y(r.y)):x.moveTo(X(r.t),Y(r.y)));x.stroke();};
draw(before,'#e4b363');draw(after,'#6fb3c9');
x.fillStyle='#6d675b';x.fillText('ince dikey çizgiler = 540 ms örnek aralığı',pad,c.height-4);
</script>`;

const browser = await chromium.launch({ executablePath: '<yerel-yol> Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const page = await browser.newPage({ viewport: { width: 940, height: 440 } });
await page.setContent(html);
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2], type: 'jpeg', quality: 82 });
await browser.close();
console.log('ok', before.length, after.length);
