/** W02 email: real INFUSED site palette and image asset. */
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const SENDER='INFUSED Tickets <joe@infusedvegas.com>';
export const LOGO_URL='https://infused.show/assets/images/infused-email-logo.png';
export function confirmationEmail({verifyUrl,unsubscribeUrl,mailingAddress=''}) {
  const verify=escapeHtml(verifyUrl), unsub=escapeHtml(unsubscribeUrl),address=escapeHtml(mailingAddress);
  const subject='INFUSED Las Vegas | Verify your email for ticket updates';
  const html=`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:Arial,Helvetica,sans-serif;color:#201929">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fb"><tr><td align="center" style="padding:30px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #eae8ed">
<tr><td style="height:6px;background:#f72c92;font-size:1px;line-height:6px">&nbsp;</td></tr>
<tr><td style="padding:28px 34px 24px;border-bottom:1px solid #eae8ed"><a href="https://infused.show/" style="color:#28164e;text-decoration:none"><img src="${LOGO_URL}" width="170" height="46" alt="INFUSED Las Vegas" style="display:block;width:170px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:37px 34px 36px"><p style="margin:0 0 12px;color:#b12d79;font-size:12px;letter-spacing:2px;font-weight:900">INFUSED LAS VEGAS</p>
<h1 style="margin:0 0 22px;font-size:34px;line-height:1.08;letter-spacing:-1px;font-weight:900;color:#201929">THANKS FOR JOINING<br>INFUSED.</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#615d6c">Tickets are on sale soon. Verify your email address to receive our on-sale announcement and qualify for <strong style="color:#28164e">25% off early-bird tickets.</strong></p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#615d6c">Click below to confirm your address. There is nothing to purchase or reserve today.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#28164e" style="background:#28164e;border-radius:8px"><a href="${verify}" style="display:inline-block;padding:17px 26px;color:#ffffff;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.6px">VERIFY EMAIL &rarr;</a></td></tr></table>
<p style="margin:27px 0 0;padding:14px 18px;border-left:4px solid #f72c92;background:#f8f9fb;font-size:13px;line-height:1.55;color:#615d6c"><strong style="color:#28164e">25% EARLY-BIRD OFFER</strong><br>Offer details will be sent when tickets become available.</p>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#615d6c">This verification link expires in 7 days. If you did not sign up, ignore this message or unsubscribe below.</p></td></tr>
<tr><td style="border-top:1px solid #eae8ed;background:#ffffff;padding:24px 34px"><p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#615d6c">INFUSED Las Vegas | From Roots to Retail<br>From: <a style="color:#28164e" href="mailto:joe@infusedvegas.com">joe@infusedvegas.com</a></p>
<p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:#615d6c">${address?address+'<br>':''}<a href="${unsub}" style="color:#28164e;text-decoration:underline">Unsubscribe from ticket notifications</a></p>
<p style="margin:0;font-size:12px;color:#615d6c">This is a one-time verification message. Ticket announcements are sent only after you confirm.</p></td></tr>
</table></td></tr></table></body></html>`;
  const text=`INFUSED Las Vegas | May 13-14, 2027\n\nTHANKS FOR JOINING INFUSED.\n\nTickets are on sale soon. Verify your email to receive our on-sale announcement and qualify for 25% off early-bird tickets. No purchase is being made now.\n\nVERIFY EMAIL:\n${verifyUrl}\n\nLink expires in 7 days.\n\nUnsubscribe:\n${unsubscribeUrl}\n\nINFUSED Tickets <joe@infusedvegas.com>\n${mailingAddress?mailingAddress+'\n':''}`;
  return {subject,html,text};
}
