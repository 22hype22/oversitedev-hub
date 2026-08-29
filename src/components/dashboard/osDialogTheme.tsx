// Shared "Oversite" dialog skin for the Extras dialogs (Custom feature, Report a
// bug): a normal solid slate panel in the brand's cold-techwear language —
// Bricolage Grotesque / Space Grotesk (loaded globally via marketing-fonts.css),
// icy accent, wide uppercase labels, and rounded-full pill CTAs.
//
// Both dialogs keep the existing `.osdlg` element classes (mhead, mico, mtt,
// mbody, mrow, lbl, inp, ta, seg, attach, filerow, mfoot, btn …) so only the
// CSS changes, not the field logic.
export const OS_DIALOG_CSS = `
.osdlg{
  --line:rgba(201,219,230,.14);--line2:rgba(201,219,230,.08);
  --heading:#E8EEF3;--body:#A8B4BF;--faint:#8A96A2;
  --accent:#C9DBE6;--accent-ink:#1E242B;--accent-deep:#B2C7D5;
  --accent-08:rgba(201,219,230,.08);--accent-12:rgba(201,219,230,.12);
  --accent-20:rgba(201,219,230,.20);--accent-30:rgba(201,219,230,.30);
  --bug:#F0A6A6;--bug-12:rgba(240,166,166,.12);--bug-28:rgba(240,166,166,.28);
  --inp:rgba(11,14,17,.6);
  --display:"Bricolage Grotesque","Space Grotesk",system-ui,sans-serif;
  --bodyf:"Space Grotesk",system-ui,sans-serif;
  --ease:cubic-bezier(.32,.72,0,1);
  font-family:var(--bodyf);
}
.osdlg .oscontent{position:relative;z-index:1;max-height:86vh;overflow-y:auto;padding:24px}

.osdlg .mhead{display:flex;align-items:flex-start;gap:14px;margin-bottom:22px}
.osdlg .mico{height:44px;width:44px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:13px}
.osdlg .mico.acc{color:var(--accent-ink);
  background:linear-gradient(160deg,#e9f1f6,var(--accent) 62%,var(--accent-deep));
  box-shadow:0 6px 18px -8px rgba(201,219,230,.55),0 1px 0 rgba(255,255,255,.6) inset}
.osdlg .mico.bug{color:var(--bug);background:var(--bug-12);border:1px solid var(--bug-28)}
.osdlg .mico svg{width:21px;height:21px}
.osdlg .mtt{flex:1;min-width:0;padding-right:26px}
.osdlg .eyebrow{font-family:var(--display);font-size:10px;font-weight:600;text-transform:uppercase;
  letter-spacing:.26em;color:var(--accent-deep);margin-bottom:6px}
.osdlg .mtt h2{margin:0;font-family:var(--display);font-size:22px;font-weight:700;letter-spacing:-.02em;
  line-height:1.08;color:var(--heading);text-shadow:0 2px 22px rgba(16,20,24,.65)}
.osdlg .mtt p{margin:8px 0 0;font-size:12.5px;color:var(--body);line-height:1.5}

.osdlg .mbody{display:flex;flex-direction:column;gap:17px}
.osdlg .mrow{display:flex;flex-direction:column;gap:8px}
.osdlg .lbl{font-family:var(--display);font-size:10.5px;font-weight:600;text-transform:uppercase;
  letter-spacing:.14em;color:var(--body)}
.osdlg .lbl .opt{color:var(--faint);letter-spacing:.1em;margin-left:7px;font-weight:500}

.osdlg .inp,.osdlg .ta{width:100%;background:var(--inp);border:1px solid var(--line);border-radius:11px;
  padding:12px 14px;color:var(--heading);font-family:var(--bodyf);font-size:14px;outline:none;
  box-shadow:0 1px 2px rgba(0,0,0,.28) inset;backdrop-filter:blur(3px);
  transition:border-color .25s var(--ease),box-shadow .25s var(--ease),background .25s var(--ease)}
.osdlg .inp::placeholder,.osdlg .ta::placeholder{color:var(--faint)}
.osdlg .inp:hover:not(:disabled),.osdlg .ta:hover:not(:disabled){border-color:var(--accent-20)}
.osdlg .inp:focus,.osdlg .ta:focus{border-color:var(--accent-30);background:rgba(11,14,17,.72);
  box-shadow:0 0 0 3px var(--accent-12),0 1px 2px rgba(0,0,0,.28) inset}
.osdlg .ta{resize:vertical;min-height:96px;line-height:1.55}
.osdlg .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:460px){.osdlg .two{grid-template-columns:1fr}}

.osdlg .seg{display:flex;gap:6px;background:var(--inp);border:1px solid var(--line);border-radius:11px;padding:4px;backdrop-filter:blur(3px)}
.osdlg .seg button{flex:1;border:none;background:transparent;color:var(--body);font-family:var(--display);
  font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  padding:8px 4px;border-radius:8px;cursor:pointer;transition:background .18s var(--ease),color .18s var(--ease)}
.osdlg .seg button:hover:not(:disabled){color:var(--heading)}
.osdlg .seg button.on{background:var(--accent);color:var(--accent-ink)}
.osdlg .seg button.on.urgent{background:var(--bug);color:#2a1618}
.osdlg .seg button:disabled{cursor:not-allowed;opacity:.6}

.osdlg .attach{display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
  border:1.5px dashed var(--line);background:rgba(201,219,230,.02);border-radius:13px;padding:14px;
  color:var(--body);font-family:var(--bodyf);backdrop-filter:blur(3px);
  transition:border-color .3s var(--ease),background .3s var(--ease),transform .3s var(--ease)}
.osdlg .attach:hover:not(:disabled){border-color:var(--accent-30);color:var(--heading);background:var(--accent-08);transform:translateY(-1px)}
.osdlg .attach:disabled{cursor:not-allowed;opacity:.6}
.osdlg .attach .pin{height:34px;width:34px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:10px;
  background:var(--accent-12);border:1px solid var(--accent-20);color:var(--accent)}
.osdlg .attach .pin svg{width:16px;height:16px}
.osdlg .attach .at{flex:1;min-width:0}
.osdlg .attach .at b{display:block;font-family:var(--display);font-size:13px;font-weight:600;color:var(--heading)}
.osdlg .attach .at span{display:block;font-size:11.5px;color:var(--faint);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-variant-numeric:tabular-nums}

.osdlg .filerow{display:flex;align-items:center;gap:9px;margin-top:9px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--inp);font-size:12.5px;color:var(--body);backdrop-filter:blur(3px)}
.osdlg .filerow .fn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.osdlg .filerow .rm{margin-left:auto;height:28px;width:28px;flex:none;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--faint);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.18s var(--ease)}
.osdlg .filerow .rm:hover:not(:disabled){color:var(--bug);border-color:var(--bug-28)}
.osdlg .filerow .rm svg{width:13px;height:13px}

.osdlg .mfoot{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding-top:20px;margin-top:22px;border-top:1px solid var(--line2)}
.osdlg .btn{font-family:var(--display);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;
  cursor:pointer;border-radius:999px;display:inline-flex;align-items:center;gap:9px;
  transition:transform .28s var(--ease),background .28s var(--ease),color .28s var(--ease),border-color .28s var(--ease),box-shadow .28s var(--ease)}
.osdlg .btn:active:not(:disabled){transform:scale(.97)}
.osdlg .btn:disabled{opacity:.6;cursor:not-allowed}
.osdlg .btn.ghost{padding:11px 22px;background:transparent;border:1px solid var(--line);color:var(--body)}
.osdlg .btn.ghost:hover:not(:disabled){color:var(--heading);border-color:var(--accent-30);background:rgba(201,219,230,.03)}
.osdlg .btn.primary{padding:11px 22px;border:1px solid var(--accent);color:var(--accent-ink);
  background:linear-gradient(160deg,#e9f1f6,var(--accent) 66%);
  box-shadow:0 10px 26px -12px rgba(201,219,230,.6),0 1px 0 rgba(255,255,255,.6) inset}
.osdlg .btn.primary:hover:not(:disabled){box-shadow:0 14px 30px -10px rgba(201,219,230,.7),0 1px 0 rgba(255,255,255,.7) inset}
.osdlg .btn svg{width:15px;height:15px}
.osdlg .btn.primary .arw{transition:transform .28s var(--ease)}
.osdlg .btn.primary:hover:not(:disabled) .arw{transform:translateX(3px)}
.osdlg .spin{animation:osdlg-spin 1s linear infinite}
@keyframes osdlg-spin{to{transform:rotate(360deg)}}
/* shadcn's built-in close (X) — lift above the content layer + icy tint */
.osdlg>button{z-index:5;color:var(--body);opacity:.9}
.osdlg>button:hover{color:var(--heading);opacity:1}
.osdlg>button svg{width:16px;height:16px}
@media(prefers-reduced-motion:reduce){.osdlg *{transition:none!important}}
`;
