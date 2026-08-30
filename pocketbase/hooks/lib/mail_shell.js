/// <reference path="../../.pb_data/types.d.ts" />

/**
 * The chrome every Land The Trick email shares.
 *
 * Taken from the design pack's email set (`design-handoff/`, "email set",
 * Version 2): a 600px card with a 3px ink border on a paper-coloured field, a
 * dark header carrying the wordmark and a section label, a coloured rule under
 * it, and a rule-topped footer. `pocketbase/templates/` holds the two auth
 * emails cut from the same shell; this module exists so the one email we build
 * ourselves — the guardian-consent request — is not the odd one out.
 *
 * **Tables and inline styles, deliberately.** A `<style>` block is stripped by
 * Gmail's web client and a Google font never loads at all, so the design's
 * display face falls back to Impact and its condensed face to Arial Narrow.
 * That is the fallback the design specifies, not an accident.
 *
 * Nothing here is Land The Trick-specific beyond the wordmark and the palette,
 * and nothing in it knows what any particular email says. Callers pass content;
 * this decides how it is framed.
 */

/** The design tokens this shell uses. Same values as `design-handoff/`. */
const INK = '#12100B';
const INK_2 = '#3A352C';
const INK_3 = '#6E665A';
const PAPER = '#FFFDF5';
const FIELD = '#F2ECDC';
const YELLOW = '#FFC23F';
const ORANGE = '#FF5A1F';

const FD = "'Anton',Impact,'Haettenschweiler','Arial Black',sans-serif";
const FC = "'Barlow Condensed','Arial Narrow',Arial,sans-serif";
const FB = "'Archivo',Helvetica,Arial,sans-serif";

/**
 * Where the badge image is served from — the app, not the API. The same
 * env-with-fallback as `consent_mail.js`'s `appUrl`, duplicated rather than
 * required from there because that module requires this one.
 */
function badgeUrl() {
  const configured = $os.getenv('LANDIT_APP_URL');
  return `${(configured || 'http://localhost:3000').replace(/\/+$/, '')}/brand/ltt-badge-64.png`;
}

/**
 * A call to action.
 *
 * Hard border and no radius, like every button in the product. `bg` defaults to
 * the orange the approve button on `/consent/approve` uses, so the parent
 * presses the same colour twice.
 */
function button(input) {
  const bg = input.background || ORANGE;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${bg}" style="border:3px solid ${INK};padding:14px 26px"><a href="${input.href}" style="font-family:${FC};font-weight:700;font-size:16px;letter-spacing:.1em;text-transform:uppercase;color:#ffffff;text-decoration:none;display:block">${input.label}</a></td>
</tr></table>`;
}

/**
 * Frame content as a Land The Trick email.
 *
 * `preheader` is the line an inbox shows beside the subject; it is hidden in the
 * body itself. `eyebrow` is the small label in the top right of the header —
 * what kind of email this is. `accent` is the rule beneath the header.
 */
function shell(input) {
  const accent = input.accent || ORANGE;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FIELD}" style="background:${FIELD};margin:0;padding:0"><tr><td align="center" style="padding:22px 10px 26px">
<div style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;color:${FIELD}">${input.preheader || ''}</div>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="width:100%;max-width:600px;background:${PAPER};border:3px solid ${INK}">
<tr><td bgcolor="${INK}" style="padding:14px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="30" height="30" valign="middle"><img src="${badgeUrl()}" width="30" height="30" alt="LTT" style="display:block;border:0"></td><td style="padding-left:9px;font-family:${FD};font-size:22px;text-transform:uppercase;color:${PAPER};line-height:1">Land The <span style="color:${YELLOW}">Trick</span></td></tr></table></td>
<td align="right" valign="middle" style="font-family:${FC};font-weight:700;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9d968a">${input.eyebrow || ''}</td>
</tr></table></td></tr>
<tr><td bgcolor="${accent}" style="height:7px;line-height:7px;font-size:0;border-top:3px solid ${INK};border-bottom:3px solid ${INK}">&nbsp;</td></tr>
<tr><td style="padding:26px 0 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 30px 14px"><h1 style="margin:0;font-family:${FD};font-size:34px;line-height:.96;text-transform:uppercase;color:${INK};font-weight:400">${input.heading}</h1></td></tr>
<tr><td style="padding:0 30px">${input.content}</td></tr>
</table></td></tr>
<tr><td style="padding:6px 30px 24px;border-top:3px solid ${INK}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-top:16px">
<div style="font-family:${FC};font-weight:700;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:${INK_3}">${input.footerNote || ''}</div>
<div style="font-family:${FB};font-size:12.5px;line-height:1.6;color:${INK_3};padding-top:8px">Land The Trick · <a href="mailto:hello@landthetrick.com" style="color:${INK_2};text-decoration:underline">hello@landthetrick.com</a></div>
</td></tr></table></td></tr>
</table></td></tr></table>`;
}

/** A body paragraph, at the size and colour the design sets. */
function p(html, options) {
  const size = (options && options.size) || 16;
  const colour = (options && options.colour) || INK_2;
  const gap = options && options.last ? '0' : '0 0 14px';
  return `<p style="margin:${gap};font-family:${FB};font-size:${size}px;line-height:1.55;color:${colour}">${html}</p>`;
}

module.exports = { shell, button, p, INK, INK_2, INK_3, ORANGE, YELLOW, FB, FC, FD };
