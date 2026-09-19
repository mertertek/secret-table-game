import type { PolicyType, SecretRole, VoteValue } from '@secret-table/contracts';
import { palette } from './palette';
import { lettering } from '../objects/Surface';
import { sceneText, type SceneLanguage } from '../i18n/sceneText';
export type CardArt = { kind: 'back' } | { kind: 'policy'; policy: PolicyType } |
  { kind: 'role'; role: SecretRole } | { kind: 'ballot'; vote: VoteValue } | { kind: 'membership'; party: PolicyType };

/** Original emblems: a leaf for liberal, a geometric bastion for fascist. */
export function emblem(ctx: CanvasRenderingContext2D, party: PolicyType, x: number, y: number, radius: number, color: string, cutout: string = palette.cream) {
  ctx.save(); ctx.translate(x, y); ctx.scale(radius, radius);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = .065;
  if (party === 'liberal') {
    ctx.beginPath(); ctx.moveTo(-.48, .65); ctx.quadraticCurveTo(-.15, -.2, .5, -.76);
    ctx.quadraticCurveTo(.68, .42, -.48, .65); ctx.fill();
    ctx.strokeStyle = cutout; ctx.lineWidth = .035;
    ctx.beginPath(); ctx.moveTo(-.5, .7); ctx.lineTo(.42, -.62); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const cy = .35 - i * .22;
      ctx.beginPath(); ctx.moveTo(-.23 + i * .13, cy); ctx.lineTo(.1 + i * .1, cy + .04); ctx.stroke();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(-.68, .65); ctx.lineTo(-.68, -.4); ctx.lineTo(-.35, -.4);
    ctx.lineTo(-.35, -.74); ctx.lineTo(.35, -.74); ctx.lineTo(.35, -.4); ctx.lineTo(.68, -.4);
    ctx.lineTo(.68, .65); ctx.closePath(); ctx.fill();
    ctx.fillStyle = cutout; ctx.fillRect(-.12, .03, .24, .62);
    ctx.fillRect(-.45, -.21, .14, .15); ctx.fillRect(.31, -.21, .14, .15);
  }
  ctx.restore();
}

export function drawCard(ctx: CanvasRenderingContext2D, w: number, h: number, art: CardArt, language: SceneLanguage = 'tr') {
  ctx.fillStyle = palette.cream; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#bca57c'; ctx.lineWidth = w * .009; ctx.strokeRect(w * .045, h * .033, w * .91, h * .934);
  if (art.kind === 'back') {
    ctx.fillStyle = '#253c35'; ctx.fillRect(w * .08, h * .06, w * .84, h * .88);
    ctx.save(); ctx.strokeStyle = '#65715a'; ctx.lineWidth = w * .003;
    ctx.beginPath();
    for (let x = -h; x < w + h; x += w * .09) { ctx.moveTo(x, h * .08); ctx.lineTo(x + h, h * .92); }
    ctx.rect(w * .1, h * .075, w * .8, h * .85); ctx.clip(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#253c35'; ctx.fillRect(-w * .24, -w * .24, w * .48, w * .48);
    ctx.strokeStyle = palette.brass; ctx.lineWidth = w * .009; ctx.strokeRect(-w * .24, -w * .24, w * .48, w * .48); ctx.restore();
    lettering(ctx, 'ST', w / 2, h / 2, w * .22, palette.cream, true);
    return;
  }
  const party = art.kind === 'ballot' ? (art.vote === 'yes' ? 'liberal' : 'fascist') : art.kind === 'role' ? (art.role === 'liberal' ? 'liberal' : 'fascist') : art.kind === 'membership' ? art.party : art.policy;
  const color = palette[party];
  const kindKey = art.kind === 'policy' ? 'card.policy' : art.kind === 'role' ? 'card.role' : art.kind === 'membership' ? 'card.membership' : 'card.ballot';
  lettering(ctx, sceneText(language, kindKey), w / 2, h * .12, w * .078, '#6f6b58');
  ctx.strokeStyle = color; ctx.lineWidth = w * .004;
  ctx.beginPath(); ctx.arc(w / 2, h * .43, w * .28, 0, Math.PI * 2); ctx.stroke();
  if (art.kind === 'ballot') {
    ctx.strokeStyle = color; ctx.lineWidth = w * .055; ctx.lineCap = 'round'; ctx.beginPath();
    if (art.vote === 'yes') { ctx.moveTo(w * .34, h * .42); ctx.lineTo(w * .46, h * .5); ctx.lineTo(w * .68, h * .33); }
    else { ctx.moveTo(w * .37, h * .34); ctx.lineTo(w * .63, h * .51); ctx.moveTo(w * .63, h * .34); ctx.lineTo(w * .37, h * .51); }
    ctx.stroke();
  } else emblem(ctx, party, w / 2, h * .43, w * .26, color);
  const titleKey = art.kind === 'ballot' ? (art.vote === 'yes' ? 'card.yes' : 'card.no') : art.kind === 'role' && art.role === 'hitler' ? 'card.hitler' : party === 'liberal' ? 'card.liberal' : 'card.fascist';
  const title = sceneText(language, titleKey);
  lettering(ctx, title, w / 2, h * .72, w * .15, color, true, w * .85);
  ctx.fillStyle = color; ctx.fillRect(w * .35, h * .83, w * .3, h * .008);
  lettering(ctx, 'SECRET TABLE', w / 2, h * .905, w * .059, '#7a705b');
}
