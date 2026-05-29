/**
 * PWAアイコン生成スクリプト
 * public/icon-192.png と public/icon-512.png を生成します
 *
 * 使い方: node scripts/gen-icons.js
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ── Utilities ────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

// ── 鳥居を描画 (drawTorii と同じロジック) ───────────────────

function drawTorii(ctx, cx, cy, s, kasagiColor, nukiColor, pillarColor, alpha){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = alpha != null ? alpha : 1;

  const pSpan = 100 * s;
  const pW    = 26  * s;
  const pTop  = -62 * s;
  const pBot  = 158 * s;

  // 柱
  ctx.fillStyle = pillarColor;
  for(const px of [-pSpan, pSpan]){
    ctx.beginPath();
    ctx.moveTo(px - pW*0.42, pTop);
    ctx.lineTo(px + pW*0.42, pTop);
    ctx.lineTo(px + pW*0.5,  pBot);
    ctx.lineTo(px - pW*0.5,  pBot);
    ctx.closePath();
    ctx.fill();
  }

  // 亀腹
  ctx.fillStyle = pillarColor;
  for(const px of [-pSpan, pSpan]){
    ctx.beginPath();
    ctx.ellipse(px, pBot + 7*s, pW*0.5 + 10*s, 9*s, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // 貫
  ctx.fillStyle = nukiColor;
  const nkHalfW = pSpan + pW*0.5 + 15*s;
  const nkY = 20 * s, nkH = 17 * s;
  ctx.beginPath();
  roundRect(ctx, -nkHalfW, nkY, nkHalfW*2, nkH, 4*s);
  ctx.fill();

  // 島木
  ctx.fillStyle = nukiColor;
  const smHalfW = pSpan + pW*0.5 + 4*s;
  const smY = -80 * s, smH = 20 * s;
  ctx.beginPath();
  roundRect(ctx, -smHalfW, smY, smHalfW*2, smH, 4*s);
  ctx.fill();

  // 笠木（反りのある曲線）
  ctx.fillStyle = kasagiColor;
  const kHW   = pSpan + pW*0.5 + 45*s;
  const kTipX = kHW + 16*s;
  const kBot  = -80 * s;
  const kTipY = -152 * s;
  const kMidY = -116 * s;

  ctx.beginPath();
  ctx.moveTo(-kHW, kBot);
  ctx.lineTo( kHW, kBot);
  ctx.bezierCurveTo(
    kHW + 14*s,  kBot,
    kTipX + 8*s, kMidY + 10*s,
    kTipX,       kTipY
  );
  ctx.bezierCurveTo(
    kTipX - 12*s, kTipY - 6*s,
    kHW * 0.55,   kMidY - 8*s,
    0,            kMidY
  );
  ctx.bezierCurveTo(
    -kHW * 0.55,   kMidY - 8*s,
    -(kTipX-12*s), kTipY - 6*s,
    -kTipX,        kTipY
  );
  ctx.bezierCurveTo(
    -(kTipX + 8*s), kMidY + 10*s,
    -(kHW + 14*s),  kBot,
    -kHW,           kBot
  );
  ctx.closePath();
  ctx.fill();

  // ハイライト
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.moveTo(-kHW + 6*s, kBot - 3*s);
  ctx.lineTo( kHW - 6*s, kBot - 3*s);
  ctx.bezierCurveTo(kHW*0.5, kBot-6*s, kHW*0.15, kMidY+18*s, 0, kMidY+20*s);
  ctx.bezierCurveTo(-kHW*0.15, kMidY+18*s, -kHW*0.5, kBot-6*s, -kHW+6*s, kBot-3*s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── アイコン描画 ─────────────────────────────────────────────

function drawIcon(size){
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const W = size, H = size;

  // 背景
  ctx.fillStyle = '#0c0a14';
  ctx.fillRect(0, 0, W, H);

  // 中央グロー
  const gl = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.47);
  gl.addColorStop(0, 'rgba(232,121,249,0.22)');
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, W, H);

  // 鳥居 (サイズに合わせてスケール)
  // 192px で s≈0.48, 512px で s≈1.28
  const scale = W / 400;

  // カラーグラデーション（笠木）
  const kGrad = ctx.createLinearGradient(0, H*0.15, W, H*0.85);
  kGrad.addColorStop(0,   '#f0abfc');
  kGrad.addColorStop(0.4, '#e879f9');
  kGrad.addColorStop(1,   '#818cf8');

  // 柱・貫カラー
  const pGrad = ctx.createLinearGradient(0, H*0.3, W, H);
  pGrad.addColorStop(0, '#d946ef');
  pGrad.addColorStop(1, '#6366f1');

  drawTorii(ctx, W/2, H*0.595, scale, kGrad, pGrad, pGrad, 1);

  return canvas;
}

// ── 出力 ─────────────────────────────────────────────────────

const publicDir = path.join(__dirname, '..', 'public');

[192, 512].forEach(size => {
  const canvas   = drawIcon(size);
  const outPath  = path.join(publicDir, `icon-${size}.png`);
  const buffer   = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ public/icon-${size}.png (${(buffer.length/1024).toFixed(1)} KB)`);
});

console.log('\n🎉 PWAアイコン生成完了！');
