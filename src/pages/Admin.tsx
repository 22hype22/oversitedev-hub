import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import containers from "@/assets/containers.webp";

/**
 * Admin panel — dashboard-styled shell. Layout is final; data hookups are wired
 * section by section. All styles are scoped under `.osadmin` so nothing leaks
 * into the rest of the app. The section markup + interactions are injected as a
 * self-contained block and the nav/toggles are activated on mount.
 */

const ADMIN_CSS = `.osadmin{
    --bg:#21272e;--panel:#272e36;--surface:#2d353e;--surface2:#343d46;--hair:#3a434d;
    --heading:#E8EEF3;--body:#A8B4BF;--faint:#788591;--accent:#C9DBE6;--accentink:#1E242B;
    --ok:#86d3a1;--bad:#e98b8b;--gold:#cbb277;
    --disp:"Bricolage Grotesque",system-ui,sans-serif;
    --bodyf:"Space Grotesk",system-ui,sans-serif;--mono:"Space Mono",monospace;
    font-family:var(--bodyf);color:var(--body);min-height:100vh;position:relative;
  }
.osadmin *{box-sizing:border-box}
.osadmin, .osadmin{margin:0;padding:0;background:#1b2026}
.osadmin .osd-bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center 20%;background-repeat:no-repeat}
.osadmin .osd-scrim{position:fixed;inset:0;z-index:0;background:linear-gradient(180deg,rgba(18,22,27,.42),rgba(18,22,27,.6) 60%,rgba(18,22,27,.74))}
.osadmin .appwrap{display:flex;min-height:100vh;position:relative;z-index:1}
.osadmin .side{width:236px;flex:none;display:flex;flex-direction:column;gap:6px;padding:18px 14px;
    background:rgba(34,40,47,.66);backdrop-filter:blur(16px);border-right:1px solid rgba(168,180,191,.12);
    position:sticky;top:0;height:100vh;overflow-y:auto}
.osadmin .prof{display:flex;align-items:center;gap:10px;padding:8px 8px 14px;border-bottom:1px solid var(--hair);margin-bottom:8px}
.osadmin .prof .av{height:38px;width:38px;border-radius:11px;background:linear-gradient(135deg,#46525E,#343D46);
    display:grid;place-items:center;color:var(--heading);font-weight:800;font-family:var(--disp);font-size:15px;flex:none}
.osadmin .prof .nm{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:13.5px;display:flex;align-items:center;gap:6px}
.osadmin .prof .pro{font-family:var(--disp);font-size:8px;font-weight:800;letter-spacing:.08em;color:var(--accentink);background:var(--accent);border-radius:5px;padding:1px 5px}
.osadmin .prof .h{font-size:11px;color:var(--faint);margin-top:1px}
.osadmin .prof .ed{margin-left:auto;color:var(--faint);cursor:pointer;display:grid;place-items:center}
.osadmin .glab{font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);padding:12px 10px 5px}
.osadmin .nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;color:var(--body);font-size:13.5px;cursor:pointer;transition:.14s}
.osadmin .nav svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none;flex:none}
.osadmin .nav:hover{background:var(--surface);color:var(--heading)}
.osadmin .nav.on{background:var(--surface2);color:var(--heading);font-weight:600}
.osadmin .nav.danger{color:#d59b9b}
.osadmin .nav.danger:hover{background:rgba(233,139,139,.10);color:#f0b4b4}
.osadmin .nav.danger.on{background:rgba(233,139,139,.14);color:#f0b4b4}
.osadmin .main{flex:1;min-width:0;padding:24px 26px 50px}
.osadmin .head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.osadmin .crumb{font-size:12px;color:var(--faint)}
.osadmin .crumb b{color:var(--heading);font-weight:600}
.osadmin .head h1{font-family:var(--disp);font-size:clamp(26px,3.2vw,38px);color:var(--heading);letter-spacing:-.025em;margin:7px 0 0;line-height:1}
.osadmin .head .sub{font-size:12.5px;color:var(--faint);margin-top:8px}
.osadmin .head .sub b{color:var(--ok);font-weight:600}
.osadmin .htools{display:flex;align-items:center;gap:11px}
.osadmin .search{display:flex;align-items:center;gap:9px;background:var(--panel);border:1px solid var(--hair);border-radius:11px;padding:9px 13px;color:var(--faint);font-size:13px;min-width:170px}
.osadmin .search svg{width:15px;height:15px;stroke:currentColor;stroke-width:1.8;fill:none}
.osadmin .bell{height:40px;width:40px;border-radius:11px;background:var(--panel);border:1px solid var(--hair);display:grid;place-items:center;color:var(--body);cursor:pointer;position:relative}
.osadmin .bell svg{width:17px;height:17px;stroke:currentColor;stroke-width:1.7;fill:none}
.osadmin .bell .d{position:absolute;top:9px;right:11px;height:6px;width:6px;border-radius:999px;background:var(--accent)}
.osadmin .cta{background:var(--accent);color:var(--accentink);border:0;border-radius:11px;padding:11px 20px;font-family:var(--bodyf);font-weight:700;font-size:13px;cursor:pointer;transition:.15s;white-space:nowrap}
.osadmin .cta:hover{filter:brightness(1.06)}
.osadmin .stage{border:1px dashed rgba(168,180,191,.22);border-radius:18px;min-height:300px;
    display:grid;place-items:center;text-align:center;color:var(--faint);
    background:linear-gradient(180deg,rgba(46,54,63,.32),rgba(39,46,54,.36));backdrop-filter:blur(6px)}
.osadmin .stage .big{color:var(--body);font-weight:600;margin-bottom:4px;font-family:var(--disp)}
.osadmin .stage .small{font-size:12px}
.osadmin{--line:rgba(168,180,191,.10);--line2:rgba(168,180,191,.16)}
.osadmin .card{border:1px solid var(--line2);border-radius:16px;background:rgba(39,46,54,.55);backdrop-filter:blur(14px)}
.osadmin .ch{display:flex;align-items:baseline;gap:10px;padding:17px 19px 0}
.osadmin .ch .eye{font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.osadmin .ch h3{margin:0;font-family:var(--disp);font-weight:700;color:var(--heading);font-size:15px;letter-spacing:-.01em}
.osadmin .ch .mut{margin-left:auto;font-size:11.5px;color:var(--faint);letter-spacing:.02em}
.osadmin .cb{padding:15px 19px 19px}
.osadmin .up{color:var(--ok)!important}
.osadmin .down{color:var(--bad)!important}
.osadmin .warn{color:var(--gold)!important}
.osadmin .pdot{height:7px;width:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px rgba(134,211,161,.16);display:inline-block;animation:pp 2.4s ease-in-out infinite}
@keyframes pp{0%,100%{opacity:1}
50%{opacity:.35}
}
.osadmin .kpis{display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:16px;
    border:1px solid var(--line2);border-radius:16px;background:rgba(39,46,54,.55);backdrop-filter:blur(14px);overflow:hidden}
.osadmin .kpi{padding:17px 18px 16px;border-left:1px solid var(--line)}
.osadmin .kpi:first-child{border-left:0}
.osadmin .kpi .lab{font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);display:flex;align-items:center;gap:7px}
.osadmin .kpi .val{font-family:var(--disp);font-size:29px;color:var(--heading);font-weight:700;letter-spacing:-.03em;margin-top:13px;line-height:1}
.osadmin .kpi .val small{font-size:13px;color:var(--faint);font-weight:600;letter-spacing:0}
.osadmin .kpi .sub{font-size:11.5px;margin-top:8px;color:var(--faint)}
.osadmin .kpi .sub b{font-weight:600}
.osadmin .ogrid{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;align-items:start}
.osadmin .ocol{display:flex;flex-direction:column;gap:16px}
.osadmin .funnel{display:flex;flex-direction:column;gap:14px;margin-top:2px}
.osadmin .fstep .flab{display:flex;align-items:baseline;gap:9px;margin-bottom:7px}
.osadmin .fstep .flab .t{font-size:13px;color:var(--heading);font-weight:600}
.osadmin .fstep .flab .n{font-family:var(--disp);font-size:13px;color:var(--heading);font-weight:700}
.osadmin .fstep .flab .p{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--faint)}
.osadmin .track{height:9px;border-radius:6px;background:rgba(168,180,191,.10);overflow:hidden}
.osadmin .track i{display:block;height:100%;border-radius:6px;background:var(--accent)}
.osadmin .track i.dim{background:rgba(201,219,230,.55)}
.osadmin .fdrop{margin-top:16px;padding-top:14px;border-top:1px solid var(--line);display:flex;align-items:center;gap:9px;font-size:12px;color:var(--body)}
.osadmin .fdrop .x{height:24px;width:24px;border-radius:7px;flex:none;display:grid;place-items:center;background:rgba(233,139,139,.12);color:var(--bad)}
.osadmin .fdrop .x svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none}
.osadmin .fdrop b{color:var(--bad);font-weight:700}
.osadmin .subhead{margin:16px 0 2px;font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.osadmin .bars{display:flex;align-items:flex-end;gap:8px;height:108px;margin-top:4px}
.osadmin .bars .b{flex:1;display:flex;flex-direction:column;align-items:center;gap:9px;color:var(--faint);font-size:10px;font-family:var(--mono)}
.osadmin .bars .b i{width:100%;max-width:30px;border-radius:5px;background:rgba(201,219,230,.22);display:block;transition:.2s}
.osadmin .bars .b.hi i{background:var(--accent)}
.osadmin .feed{position:relative;margin-top:2px;padding-left:16px}
.osadmin .feed:before{content:"";position:absolute;left:3px;top:4px;bottom:4px;width:1px;background:var(--line2)}
.osadmin .frow{position:relative;display:flex;align-items:baseline;gap:10px;padding:8px 0}
.osadmin .frow .d{position:absolute;left:-16px;top:12px;height:7px;width:7px;border-radius:50%;background:var(--faint)}
.osadmin .frow .d.ok{background:var(--ok)}
.osadmin .frow .d.bad{background:var(--bad)}
.osadmin .frow .d.ac{background:var(--accent)}
.osadmin .frow .t{font-size:12.5px;color:var(--heading);font-weight:600}
.osadmin .frow .t.muted{color:var(--body);font-weight:500}
.osadmin .frow .tm{margin-left:auto;font-size:10.5px;color:var(--faint);font-family:var(--mono);white-space:nowrap}
.osadmin .lrow{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--line);font-size:13px}
.osadmin .lrow:first-child{border-top:0}
.osadmin .lrow .nm{color:var(--heading);font-weight:600}
.osadmin .lrow .sp{margin-left:auto;color:var(--faint);font-size:12px;font-family:var(--mono)}
.osadmin .lrow .meter{margin-left:auto;display:flex;align-items:center;gap:10px}
.osadmin .lrow .meter .bar{width:90px;height:6px;border-radius:4px;background:rgba(168,180,191,.1);overflow:hidden}
.osadmin .lrow .meter .bar i{display:block;height:100%;background:var(--accent);border-radius:4px}
.osadmin .lrow .meter .v{font-family:var(--mono);font-size:11.5px;color:var(--faint);width:54px;text-align:right}
.osadmin .mono{font-family:var(--mono)}
@media(max-width:1050px){.osadmin .kpis{grid-template-columns:repeat(2,1fr)}
.osadmin .kpi:nth-child(odd){border-left:0}
.osadmin .ogrid{grid-template-columns:1fr}
}
.osadmin .scols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.osadmin .frm{display:flex;flex-direction:column;gap:12px}
.osadmin .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.osadmin .lbl{display:block;font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}
.osadmin .in{width:100%;background:rgba(33,39,46,.6);border:1px solid var(--line2);border-radius:10px;padding:9px 12px;color:var(--heading);font-size:13px;font-family:var(--bodyf);outline:none}
.osadmin .in::placeholder{color:var(--faint)}
.osadmin .in:focus{border-color:rgba(201,219,230,.5)}
.osadmin textarea.in{min-height:76px;resize:vertical;line-height:1.5}
.osadmin .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:var(--accent);color:var(--accentink);border:0;border-radius:10px;padding:9px 15px;font-family:var(--bodyf);font-weight:700;font-size:12.5px;cursor:pointer;transition:.15s}
.osadmin .btn:hover{filter:brightness(1.06)}
.osadmin .btn.ghost{background:transparent;color:var(--heading);border:1px solid var(--line2)}
.osadmin .btn.ghost:hover{background:rgba(232,238,243,.06);filter:none}
.osadmin .btn svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none}
.osadmin .seg{display:inline-flex;background:rgba(33,39,46,.6);border:1px solid var(--line2);border-radius:9px;padding:3px;gap:3px}
.osadmin .seg button{border:0;background:transparent;color:var(--body);font-family:var(--bodyf);font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer}
.osadmin .seg button.on{background:var(--surface2);color:var(--heading)}
.osadmin .tag{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:20px}
.osadmin .tag.g{background:rgba(134,211,161,.14);color:var(--ok)}
.osadmin .tag.n{background:rgba(168,180,191,.12);color:var(--faint)}
.osadmin .tag.a{background:rgba(203,178,119,.16);color:var(--gold)}
.osadmin .crow{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:13px}
.osadmin .crow:first-child{border-top:0}
.osadmin .crow .c{font-family:var(--mono);color:var(--heading);font-weight:600}
.osadmin .crow .meta{color:var(--faint);font-size:11.5px}
.osadmin .crow .sp{margin-left:auto;display:flex;align-items:center;gap:10px}
.osadmin .ic{height:28px;width:28px;border-radius:8px;border:1px solid var(--line2);background:rgba(33,39,46,.5);color:var(--faint);display:grid;place-items:center;cursor:pointer}
.osadmin .ic:hover{color:var(--heading)}
.osadmin .ic svg{width:14px;height:14px;stroke:currentColor;stroke-width:1.8;fill:none}
.osadmin .subnote{font-size:11.5px;color:var(--faint);line-height:1.5}
.osadmin .btn.sm{padding:7px 13px;font-size:12px}
.osadmin .ovrcode{font-family:var(--mono);font-size:23px;letter-spacing:.1em;color:var(--heading);font-weight:700;text-align:center;
    background:rgba(33,39,46,.55);border:1px dashed var(--line2);border-radius:12px;padding:15px 18px}
.osadmin .ovrrow{display:flex;align-items:center;justify-content:space-between;margin-top:13px}
.osadmin .ovrrow .timer{font-family:var(--mono);font-size:12.5px;color:var(--gold)}
.osadmin .ovrrow .timer b{color:var(--heading)}
.osadmin .ovrrow .oacts{display:flex;gap:9px}
.osadmin .listcap{font-family:var(--disp);font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin:16px 0 2px}
.osadmin select.in{appearance:none;-webkit-appearance:none;cursor:pointer;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23788591' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>");
    background-repeat:no-repeat;background-position:right 11px center;padding-right:30px}
.osadmin .catform{display:grid;grid-template-columns:2fr 1fr 1.3fr auto;gap:10px;align-items:end}
.osadmin .chips{display:flex;flex-wrap:wrap;gap:7px;margin:15px 0 4px}
.osadmin .chip{font-family:var(--bodyf);font-size:12px;font-weight:600;color:var(--body);background:rgba(33,39,46,.6);border:1px solid var(--line2);border-radius:20px;padding:5px 12px;cursor:pointer}
.osadmin .chip.on{background:var(--accent);color:var(--accentink);border-color:transparent}
.osadmin .chip.add{color:var(--faint);border-style:dashed}
.osadmin .price{font-family:var(--mono);font-size:13px;color:var(--heading);font-weight:700}
.osadmin .price.free{color:var(--ok)}
@media(max-width:1050px){.osadmin .scols{grid-template-columns:1fr}
.osadmin .catform{grid-template-columns:1fr 1fr}
}
.osadmin .minis{display:flex;border:1px solid var(--line2);border-radius:12px;overflow:hidden;margin-bottom:15px}
.osadmin .mini{flex:1;padding:12px 14px;border-left:1px solid var(--line)}
.osadmin .mini:first-child{border-left:0}
.osadmin .mini .l{font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.osadmin .mini .v{font-family:var(--disp);font-size:21px;color:var(--heading);font-weight:700;margin-top:6px;line-height:1}
.osadmin .reveal{display:flex;align-items:center;gap:10px;margin:4px 0 14px;padding:11px 13px;border:1px solid rgba(203,178,119,.4);background:rgba(203,178,119,.07);border-radius:11px}
.osadmin .reveal .rc{flex:1;font-family:var(--mono);font-size:12.5px;color:var(--heading);word-break:break-all}
.osadmin .reveal .rl{font-size:10px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
.osadmin .wlegend{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:14px;padding-top:13px;border-top:1px solid var(--line);font-size:11.5px;color:var(--faint)}
.osadmin .wlegend span{display:inline-flex;align-items:center;gap:7px}
.osadmin .last-ok{color:var(--ok);font-weight:600}
.osadmin .last-no{color:var(--faint);font-weight:600}
.osadmin .qrow{display:flex;align-items:center;gap:11px;padding:10px 0;border-top:1px solid var(--line);font-size:12.5px}
.osadmin .qrow:first-child{border-top:0}
.osadmin .qrow .act{font-family:var(--mono);color:var(--heading);font-weight:600}
.osadmin .qrow .who{color:var(--faint);font-size:11.5px}
.osadmin .qrow .sp{margin-left:auto;display:flex;align-items:center;gap:10px}
.osadmin .qrow .tm{color:var(--faint);font-family:var(--mono);font-size:10.5px}
.osadmin .redeem{display:flex;gap:10px;align-items:stretch}
.osadmin .redeem .in{flex:1}
.osadmin .inner{border:1px solid var(--line2);border-radius:12px;padding:14px;background:rgba(33,39,46,.4);margin-top:12px}
.osadmin .inner .who{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:14px}
.osadmin .inner .sub2{font-size:11.5px;color:var(--faint);margin-top:2px}
.osadmin .botline{display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--line);font-size:12.5px}
.osadmin .botline:first-of-type{border-top:0}
.osadmin .botline .nm{color:var(--heading);font-weight:600}
.osadmin .botline .sp{margin-left:auto;color:var(--faint);font-size:11px}
.osadmin .log{font-size:12.5px}
.osadmin .log .th{display:grid;gap:12px;padding:0 0 9px;font-family:var(--disp);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.osadmin .log .tr{display:grid;gap:12px;padding:11px 0;border-top:1px solid var(--line);align-items:center}
.osadmin .log .tr{border-top:1px solid var(--line)}
.osadmin .log .c1{color:var(--heading);font-weight:600}
.osadmin .log .mn{font-family:var(--mono);color:var(--body)}
.osadmin .log .tm{color:var(--faint);font-family:var(--mono);font-size:11px}
.osadmin .log .amt{font-family:var(--mono);color:var(--heading);font-weight:700}
.osadmin .log .right{text-align:right}
.osadmin .logtools{display:flex;align-items:center;gap:8px;margin-left:auto}
.osadmin .logtools .srch{display:flex;align-items:center;gap:7px;background:rgba(33,39,46,.6);border:1px solid var(--line2);border-radius:9px;padding:6px 11px;color:var(--faint);font-size:12px}
.osadmin .logtools .srch svg{width:13px;height:13px;stroke:currentColor;stroke-width:1.8;fill:none}
.osadmin .adm{display:flex;align-items:center;gap:11px;padding:11px;border:1px solid var(--line2);border-radius:11px;margin-bottom:9px;cursor:pointer;transition:.14s;background:rgba(33,39,46,.4)}
.osadmin .adm:hover{border-color:rgba(201,219,230,.4)}
.osadmin .adm.sel{border-color:var(--accent);background:rgba(201,219,230,.07)}
.osadmin .adm .av{height:32px;width:32px;border-radius:9px;background:linear-gradient(135deg,#46525E,#343D46);display:grid;place-items:center;color:var(--heading);font-weight:800;font-family:var(--disp);font-size:13px;flex:none}
.osadmin .adm .em{font-size:13px;color:var(--heading);font-weight:600}
.osadmin .adm .ro{font-size:11px;color:var(--faint)}
.osadmin .adm .x{margin-left:auto}
.osadmin .permrow{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}
.osadmin .permrow:first-of-type{border-top:0}
.osadmin .permrow .pt{font-size:13px;color:var(--heading);font-weight:600}
.osadmin .permrow .pd{font-size:11.5px;color:var(--faint);margin-top:1px}
.osadmin .sw{position:relative;height:22px;width:38px;border-radius:999px;background:var(--surface2);cursor:pointer;transition:.2s;flex:none;margin-left:auto}
.osadmin .sw.on{background:var(--accent)}
.osadmin .sw.lock{opacity:.5;cursor:not-allowed}
.osadmin .sw i{position:absolute;top:3px;left:3px;height:16px;width:16px;border-radius:50%;background:#cfd8df;transition:.2s}
.osadmin .sw.on i{left:19px;background:var(--accentink)}
.osadmin .permhead{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.osadmin .permhead .pe{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:14px}
.osadmin .drop{border:1.5px dashed var(--line2);border-radius:13px;padding:26px 18px;text-align:center;color:var(--faint);cursor:pointer;transition:.15s;background:rgba(33,39,46,.3)}
.osadmin .drop:hover{border-color:rgba(201,219,230,.45);color:var(--body)}
.osadmin .drop svg{width:24px;height:24px;stroke:currentColor;stroke-width:1.7;fill:none;margin-bottom:8px}
.osadmin .drop .dt{font-family:var(--disp);font-weight:700;color:var(--body);font-size:13.5px}
.osadmin .drop .ds{font-size:11.5px;margin-top:3px}
.osadmin .capgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px;margin-top:4px}
.osadmin .capcard{border:1px solid var(--line2);border-radius:12px;overflow:hidden;background:rgba(33,39,46,.4)}
.osadmin .capimg{height:72px;display:grid;place-items:center;position:relative;
    background:
      repeating-linear-gradient(45deg,rgba(168,180,191,.05) 0 6px,transparent 6px 12px),
      linear-gradient(135deg,#2c343d,#242b32)}
.osadmin .capimg .txt{font-family:var(--mono);font-size:21px;font-weight:700;letter-spacing:.14em;color:var(--heading);transform:skewX(-9deg);opacity:.9;text-shadow:0 1px 0 rgba(0,0,0,.4)}
.osadmin .capmeta{display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid var(--line)}
.osadmin .capmeta .ans{font-family:var(--mono);color:var(--body);font-size:11.5px}
.osadmin .capmeta .del{margin-left:auto;height:24px;width:24px;border-radius:7px;border:1px solid var(--line2);background:transparent;color:var(--faint);display:grid;place-items:center;cursor:pointer}
.osadmin .capmeta .del:hover{color:var(--bad);border-color:rgba(233,139,139,.4)}
.osadmin .capmeta .del svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.9;fill:none}
.osadmin .dz .card{border-color:rgba(233,139,139,.28);background:rgba(233,139,139,.045)}
.osadmin .dz .ch .eye{color:var(--bad)}
.osadmin .dz .ch h3{color:#f0b4b4}
.osadmin .dzrow{display:flex;align-items:center;gap:14px}
.osadmin .dzrow .lbl2{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:15px}
.osadmin .dzrow .st{font-size:12px;margin-top:2px;color:var(--faint)}
.osadmin .dzrow .sw{margin-left:auto}
.osadmin .statusline{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--heading);font-weight:600;margin-bottom:10px}
.osadmin .btn.danger{background:#e08a8a;color:#2a1213;border:0}
.osadmin .btn.danger:hover{filter:brightness(1.06)}
.osadmin .btn.danger.big{padding:12px 20px;font-size:13.5px}
.osadmin .confirm{display:flex;gap:10px;align-items:center;margin-top:13px}
.osadmin .confirm .in{flex:1;border-color:rgba(233,139,139,.35)}
.osadmin .pill-live{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:20px;background:rgba(134,211,161,.14);color:var(--ok)}
.osadmin .pill-down{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:20px;background:rgba(233,139,139,.16);color:var(--bad)}
@media(max-width:1050px){.osadmin .kpis{grid-template-columns:repeat(2,1fr)}
.osadmin .ogrid{grid-template-columns:1fr}
}
`;

const ADMIN_HTML = `<div class="osd app">
  <div class="osd-bg" style="background-image:url()"></div>
  <div class="osd-scrim"></div>

  <div class="appwrap show">
    <!-- sidebar -->
    <aside class="side">
      <div class="prof">
        <div class="av">E</div>
        <div>
          <div class="nm">Hype <span class="pro">OWNER</span></div>
          <div class="h">everant00@gmail.com</div>
        </div>
        <span class="ed"><svg width="14" height="14" viewBox="0 0 24 24" style="stroke:currentColor;stroke-width:1.8;fill:none"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span>
      </div>

      <div class="glab">Manage</div>
      <div class="nav on" data-sec="Overview" data-sub="At-a-glance health of the platform"><svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/></svg>Overview</div>
      <div class="nav" data-sec="Storefront" data-sub="Categories, products, pricing, discount &amp; billing codes"><svg viewBox="0 0 24 24"><path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg>Storefront</div>
      <div class="nav" data-sec="Bots &amp; Workers" data-sub="Bot secrets, token pool, and worker auth tokens"><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>Bots &amp; Workers</div>
      <div class="nav" data-sec="Support Access" data-sub="Redeem support codes and send notifications"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 2.5"/><path d="M12 17h.01"/></svg>Support Access</div>
      <div class="nav" data-sec="Logs &amp; history" data-sub="Bot orders, purchases, accounts, and admin actions"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>Logs &amp; history</div>

      <div class="glab">Owner</div>
      <div class="nav" data-sec="Super admin" data-sub="Manage who has admin access to the platform"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>Super admin</div>
      <div class="nav" data-sec="Captcha images" data-sub="Shared image pool for bots using image captcha"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/></svg>Captcha images</div>
      <div class="nav danger" data-sec="Danger zone" data-sub="Destructive actions affecting the live store &amp; data"><svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>Danger zone</div>

      <div style="margin-top:auto"></div>
      <div class="nav"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14.5 14.5 0 0 0 0 18 14.5 14.5 0 0 0 0-18"/></svg>Back to website</div>
      <div class="nav"><svg viewBox="0 0 24 24"><path d="M9 21H5V3h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>Sign out</div>
    </aside>

    <!-- main -->
    <div class="main">
      <div class="head">
        <div>
          <div class="crumb">Oversite / Admin / <b id="crumb">Overview</b></div>
          <h1 id="title">Overview</h1>
          <div class="sub" id="sub">At-a-glance health of the platform</div>
        </div>
        <div class="htools">
          <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Search</label>
        </div>
      </div>

      <!-- ───── OVERVIEW (rich analytics) ───── -->
      <div id="overview-content">
        <!-- KPI strip -->
        <div class="kpis">
          <div class="kpi">
            <div class="lab"><span class="pdot"></span> Live now</div>
            <div class="val">24</div>
            <div class="sub">on the site · <b class="up">3 in checkout</b></div>
          </div>
          <div class="kpi">
            <div class="lab">Bots sold</div>
            <div class="val">128 <small>total</small></div>
            <div class="sub"><b class="up">+6</b> today · <b class="up">+21</b> this week</div>
          </div>
          <div class="kpi">
            <div class="lab">Revenue</div>
            <div class="val">$3,712</div>
            <div class="sub">this week · <b class="up">+12%</b></div>
          </div>
          <div class="kpi">
            <div class="lab">Conversion</div>
            <div class="val">9.6%</div>
            <div class="sub">visit → paid · 7d</div>
          </div>
        </div>

        <div class="ogrid">
          <!-- LEFT column -->
          <div class="ocol">
            <!-- Funnel -->
            <div class="card">
              <div class="ch"><span class="eye">Conversion</span><h3>Checkout funnel</h3><span class="mut">last 7 days</span></div>
              <div class="cb">
                <div class="funnel">
                  <div class="fstep">
                    <div class="flab"><span class="t">Visited the site</span><span class="n">1,000</span><span class="p">100%</span></div>
                    <div class="track"><i style="width:100%"></i></div>
                  </div>
                  <div class="fstep">
                    <div class="flab"><span class="t">Started a bot build</span><span class="n">420</span><span class="p">42%</span></div>
                    <div class="track"><i style="width:42%"></i></div>
                  </div>
                  <div class="fstep">
                    <div class="flab"><span class="t">Reached checkout</span><span class="n">180</span><span class="p">18%</span></div>
                    <div class="track"><i style="width:18%"></i></div>
                  </div>
                  <div class="fstep">
                    <div class="flab"><span class="t">Paid</span><span class="n">96</span><span class="p">9.6%</span></div>
                    <div class="track"><i class="dim" style="width:9.6%"></i></div>
                  </div>
                </div>
                <div class="fdrop">
                  <span class="x"><svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg></span>
                  <span><b>84 reached payment and gave up</b> — 47% of checkouts abandoned</span>
                </div>
                <div class="subhead">Recent abandons · recover these</div>
                <div class="lrow"><span class="nm">Oversite Protection</span><span class="sp" style="margin-left:9px">user_4f21 · 8m ago</span></div>
                <div class="lrow"><span class="nm">Oversite Support</span><span class="sp" style="margin-left:9px">guest · 31m ago</span></div>
                <div class="lrow"><span class="nm">Oversite Utilities</span><span class="sp" style="margin-left:9px">user_9c03 · 1h ago</span></div>
              </div>
            </div>

            <!-- Traffic chart -->
            <div class="card">
              <div class="ch"><span class="eye">Traffic</span><h3>Visitors</h3><span class="mut">this week · 1,000 total</span></div>
              <div class="cb">
                <div class="bars">
                  <div class="b"><i style="height:46%"></i>Sun</div>
                  <div class="b"><i style="height:62%"></i>Mon</div>
                  <div class="b"><i style="height:54%"></i>Tue</div>
                  <div class="b"><i style="height:78%"></i>Wed</div>
                  <div class="b"><i style="height:70%"></i>Thu</div>
                  <div class="b hi"><i style="height:96%"></i>Fri</div>
                  <div class="b"><i style="height:84%"></i>Sat</div>
                </div>
              </div>
            </div>
          </div>

          <!-- RIGHT column -->
          <div class="ocol">
            <!-- Fleet health -->
            <div class="card">
              <div class="ch"><span class="eye">Status</span><h3>Fleet health</h3></div>
              <div class="cb">
                <div class="lrow"><span class="pdot"></span><span class="nm">Bots online</span><span class="sp">37 / 37</span></div>
                <div class="lrow"><span class="nm">Orders in progress</span><span class="sp warn">5 · building</span></div>
                <div class="lrow"><span class="pdot"></span><span class="nm">Utilities bot</span><span class="sp up">seen 4s ago</span></div>
                <div class="lrow"><span class="nm">Pending commands</span><span class="sp warn">1 · clearing</span></div>
                <div class="lrow"><span class="nm">Worker tokens</span><span class="sp">2 active</span></div>
              </div>
            </div>

            <!-- Top sellers -->
            <div class="card">
              <div class="ch"><span class="eye">7 days</span><h3>Top sellers</h3></div>
              <div class="cb">
                <div class="lrow"><span class="nm">Protection</span><span class="meter"><span class="bar"><i style="width:100%"></i></span><span class="v">54</span></span></div>
                <div class="lrow"><span class="nm">Support</span><span class="meter"><span class="bar"><i style="width:76%"></i></span><span class="v">41</span></span></div>
                <div class="lrow"><span class="nm">Utilities</span><span class="meter"><span class="bar"><i style="width:61%"></i></span><span class="v">33</span></span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ───── STOREFRONT ───── -->
      <div id="storefront-content" style="display:none">
        <!-- Row 1: codes side by side, identical structure -->
        <div class="scols">
          <!-- Discount codes -->
          <div class="card">
            <div class="ch"><span class="eye">Promos</span><h3>Discount codes</h3></div>
            <div class="cb">
              <div class="row2">
                <div><label class="lbl">Code</label><input class="in" placeholder="LAUNCH20"></div>
                <div><label class="lbl">Amount</label><input class="in" placeholder="20%"></div>
              </div>
              <button class="btn" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Create code</button>
              <div class="listcap">Active codes</div>
              <div class="crow"><div><div class="c">LAUNCH20</div><div class="meta">20% off · 41 uses</div></div><span class="sp"><span class="tag g">active</span><span class="ic"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span></span></div>
              <div class="crow"><div><div class="c">FRIEND10</div><div class="meta">10% off · 12 uses</div></div><span class="sp"><span class="tag n">expired</span><span class="ic"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span></span></div>
            </div>
          </div>

          <!-- Free hosting codes -->
          <div class="card">
            <div class="ch"><span class="eye">Comp</span><h3>Free hosting codes</h3></div>
            <div class="cb">
              <div class="row2">
                <div><label class="lbl">Duration</label><input class="in" placeholder="30 days"></div>
                <div><label class="lbl">Uses</label><input class="in" placeholder="1"></div>
              </div>
              <button class="btn" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Generate code</button>
              <div class="listcap">Issued codes</div>
              <div class="crow"><div><div class="c">FREE-9X2K-AA</div><div class="meta">30 days · unused</div></div><span class="sp"><span class="tag g">active</span><span class="ic"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span></span></div>
              <div class="crow"><div><div class="c">FREE-3M7P-Q2</div><div class="meta">14 days · redeemed</div></div><span class="sp"><span class="tag n">used</span><span class="ic"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span></span></div>
            </div>
          </div>
        </div>

        <!-- Row 2: billing override | combined announcements -->
        <div class="scols" style="margin-top:16px;align-items:start">
          <!-- Billing override -->
          <div class="card">
            <div class="ch"><span class="eye">Rotating · 15 min</span><h3>Billing override code</h3></div>
            <div class="cb">
              <div class="ovrcode">OVR-7F3A-9C21</div>
              <div class="ovrrow">
                <span class="timer">expires in <b>12:47</b></span>
                <span class="oacts">
                  <button class="btn ghost sm"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>Refresh</button>
                  <button class="btn sm"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Copy</button>
                </span>
              </div>
              <div class="subnote" style="margin-top:13px">Single-use override for billing. Auto-expires every 15 minutes — refresh to roll a new one.</div>
            </div>
          </div>

          <!-- Announcements (combined: dashboards + server) -->
          <div class="card">
            <div class="ch"><span class="eye">Broadcast</span><h3>Announcements</h3></div>
            <div class="cb">
              <label class="lbl">Send to</label>
              <div class="seg" id="dest">
                <button class="on" data-dash="1">Dashboards</button>
                <button data-dash="0">Discord server</button>
                <button data-dash="1">Both</button>
              </div>

              <div id="dashfields" style="margin-top:12px">
                <div class="row2" style="align-items:end">
                  <div><label class="lbl">Type</label><div class="seg"><button class="on">Note</button><button>Fix</button></div></div>
                  <div><label class="lbl">Title</label><input class="in" placeholder="e.g. Scheduled maintenance"></div>
                </div>
              </div>

              <div style="margin-top:12px"><label class="lbl">Message</label><textarea class="in" placeholder="What everyone should see."></textarea></div>
              <button class="btn" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/></svg>Publish</button>
              <div class="subnote" style="margin-top:10px">Server posts go out through the Oversite Utilities bot — same path as Support &amp; Ideas.</div>

              <div class="listcap">Live now</div>
              <div class="crow"><div class="nm" style="color:var(--heading);font-weight:600">Welcome to the team</div><span class="sp"><span class="tag a">note</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span></span></div>
              <div class="crow"><div class="nm" style="color:var(--heading);font-weight:600">Verification reset fix live</div><span class="sp"><span class="tag g">fix</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span></span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ───── BOTS & WORKERS ───── -->
      <div id="bots-content" style="display:none">
        <!-- Worker tokens (hero) -->
        <div class="card" style="margin-bottom:16px">
          <div class="ch"><span class="eye">Auth</span><h3>Worker tokens</h3><span class="mut">the handshake every bot uses — treat like passwords</span></div>
          <div class="cb">
            <div class="catform" style="grid-template-columns:1.6fr 1.6fr 1fr auto">
              <div><label class="lbl">Name</label><input class="in" placeholder="railway-prod"></div>
              <div><label class="lbl">Bot ID <span style="text-transform:none;letter-spacing:0">(optional — restricts to one bot)</span></label><input class="in" placeholder="leave empty for all bots"></div>
              <div><label class="lbl">Notes</label><input class="in" placeholder="optional"></div>
              <button class="btn"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Create</button>
            </div>

            <div class="reveal">
              <span class="rc">wtk_live_9f3a8c21d4b7e0a6f2c5…</span>
              <span class="rl">⚠ copy now — shown once</span>
              <span class="ic"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></span>
            </div>

            <div class="listcap">Tokens</div>
            <div class="crow"><div><div class="c">railway-prod <span class="tag g">active</span></div><div class="meta mono">wtk_9f3a…</div></div><span class="sp"><span>Last used <span class="last-ok">3s ago</span></span><span class="ic"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></span></span></div>
            <div class="crow"><div><div class="c">old-project <span class="tag n">unused</span></div><div class="meta mono">wtk_2b71…</div></div><span class="sp"><span>Last used <span class="last-no">Never</span></span><span class="ic"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></span></span></div>

            <div class="wlegend">
              <span><span class="pdot"></span> recently used = bot is reaching <b style="color:var(--body)">this</b> project</span>
              <span><span class="d bad" style="height:7px;width:7px;border-radius:50%;background:var(--bad);display:inline-block"></span> never used = wrong project or not deployed</span>
            </div>
          </div>
        </div>

        <!-- Token pool | Bot secret slots -->
        <div class="scols" style="align-items:start">
          <!-- Token pool -->
          <div class="card">
            <div class="ch"><span class="eye">Discord tokens</span><h3>Token pool</h3></div>
            <div class="cb">
              <div class="minis">
                <div class="mini"><div class="l">Available</div><div class="v">14</div></div>
                <div class="mini"><div class="l">Assigned</div><div class="v">37</div></div>
                <div class="mini"><div class="l">Retired</div><div class="v">3</div></div>
              </div>
              <div class="row2"><div><label class="lbl">Bot username</label><input class="in" placeholder="MyBot#0001"></div><div><label class="lbl">Client ID</label><input class="in" placeholder="1304…"></div></div>
              <div style="margin-top:10px"><label class="lbl">Token</label><input class="in mono" placeholder="paste bot token"></div>
              <button class="btn" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add to pool</button>
              <div class="listcap">Pool</div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">ShieldBot#0007</div><div class="meta mono">1304… · ••••8f2a</div></div><span class="sp"><span class="tag n">available</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></span></span></div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">HelpBot#0042</div><div class="meta mono">1299… · ••••1c7d</div></div><span class="sp"><span class="tag g">assigned</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></span></span></div>
            </div>
          </div>

          <!-- Bot secret slots -->
          <div class="card">
            <div class="ch"><span class="eye">Config schema</span><h3>Bot secret slots</h3><span class="mut">fields bots ask for</span></div>
            <div class="cb">
              <div class="row2"><div><label class="lbl">Key</label><input class="in mono" placeholder="WEBHOOK_URL"></div><div><label class="lbl">Label</label><input class="in" placeholder="Webhook URL"></div></div>
              <div class="row2" style="margin-top:10px;align-items:end">
                <div><label class="lbl">Addon</label><select class="in"><option>base</option><option>stats</option><option>giveaways</option></select></div>
                <div><label class="lbl">Required</label><div class="seg"><button class="on">Required</button><button>Optional</button></div></div>
              </div>
              <button class="btn" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add slot</button>
              <div class="listcap">Slots</div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">Discord token</div><div class="meta mono">DISCORD_TOKEN · base</div></div><span class="sp"><span class="tag a">required</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span></span></div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">Webhook URL</div><div class="meta mono">WEBHOOK_URL · base</div></div><span class="sp"><span class="tag n">optional</span><span class="ic"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></span></span></div>
            </div>
          </div>
        </div>

      </div>

      <!-- ───── SUPPORT ACCESS ───── -->
      <div id="support-content" style="display:none">
        <div class="scols" style="align-items:start">
          <!-- Redeem support code -->
          <div class="card">
            <div class="ch"><span class="eye">Access</span><h3>Support access</h3><span class="mut">enter a user's dashboard temporarily</span></div>
            <div class="cb">
              <label class="lbl">Support code</label>
              <div class="redeem">
                <input class="in mono" placeholder="XXXX-XXXX-XXXX">
                <button class="btn"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>Redeem</button>
              </div>
              <div class="subnote" style="margin-top:10px">Paste a user-issued code to open their bot dashboard. Access auto-expires.</div>

              <div class="listcap">Active access</div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">mia@example.com</div><div class="meta">expires in 1h 12m</div></div><span class="sp"><button class="btn ghost sm">Open</button><span class="ic"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span></span></div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">leo@example.com</div><div class="meta">expires in 22m</div></div><span class="sp"><button class="btn ghost sm">Open</button><span class="ic"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span></span></div>

              <div class="listcap">Recent</div>
              <div class="crow"><div><div class="c" style="font-family:var(--bodyf);font-weight:600">sam@example.com</div><div class="meta">ended 2d ago</div></div><span class="sp"><span class="tag n">expired</span></span></div>
            </div>
          </div>

          <!-- Customer lookup -->
          <div class="card">
            <div class="ch"><span class="eye">Find</span><h3>Customer lookup</h3><span class="mut">who you're helping</span></div>
            <div class="cb">
              <label class="lbl">Search by email or bot</label>
              <div class="redeem">
                <input class="in" placeholder="mia@example.com">
                <button class="btn ghost"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Search</button>
              </div>

              <div class="inner">
                <div class="who">mia@example.com</div>
                <div class="sub2">Joined 4 months ago · 2 bots · billing active</div>
                <div style="margin-top:10px">
                  <div class="botline"><span class="pdot"></span><span class="nm">Protection Bot</span><span class="sp">online · 1 server</span></div>
                  <div class="botline"><span class="pdot"></span><span class="nm">Utilities Bot</span><span class="sp">online · 2 servers</span></div>
                </div>
                <button class="btn ghost sm" style="margin-top:12px"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>Request access</button>
              </div>
              <div class="subnote" style="margin-top:10px">Read-only summary. To act on their dashboard, request a support code.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ───── LOGS & HISTORY ───── -->
      <div id="logs-content" style="display:none">
        <!-- Bot orders & preorders -->
        <div class="card" style="margin-bottom:16px">
          <div class="ch"><span class="eye">Sales</span><h3>Bot orders &amp; preorders</h3>
            <div class="logtools"><span class="srch"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>Search</span></div>
          </div>
          <div class="cb">
            <div class="chips" style="margin-top:0">
              <span class="chip on">All</span><span class="chip">Orders</span><span class="chip">Preorders</span>
            </div>
            <div class="log">
              <div class="th" style="grid-template-columns:0.8fr 1.6fr 1fr 0.9fr 0.6fr">
                <span>Order</span><span>Customer</span><span>Base</span><span>Status</span><span class="right">When</span>
              </div>
              <div class="tr" style="grid-template-columns:0.8fr 1.6fr 1fr 0.9fr 0.6fr">
                <span class="mn">#10482</span><span class="c1">mia@example.com</span><span>Protection</span><span><span class="tag g">paid</span></span><span class="tm right">2h</span>
              </div>
              <div class="tr" style="grid-template-columns:0.8fr 1.6fr 1fr 0.9fr 0.6fr">
                <span class="mn">#10481</span><span class="c1">leo@example.com</span><span>Utilities</span><span><span class="tag a">preorder</span></span><span class="tm right">5h</span>
              </div>
              <div class="tr" style="grid-template-columns:0.8fr 1.6fr 1fr 0.9fr 0.6fr">
                <span class="mn">#10480</span><span class="c1">sam@example.com</span><span>Support</span><span><span class="tag n">building</span></span><span class="tm right">6h</span>
              </div>
              <div class="tr" style="grid-template-columns:0.8fr 1.6fr 1fr 0.9fr 0.6fr">
                <span class="mn">#10479</span><span class="c1">ava@example.com</span><span>Protection</span><span><span class="tag g">paid</span></span><span class="tm right">9h</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Purchase logs | Account signups -->
        <div class="scols" style="align-items:start">
          <div class="card">
            <div class="ch"><span class="eye">Payments</span><h3>Purchase logs</h3></div>
            <div class="cb">
              <div class="log">
                <div class="th" style="grid-template-columns:0.7fr 0.9fr 1.6fr 0.6fr"><span>Amount</span><span>Method</span><span>Customer</span><span class="right">When</span></div>
                <div class="tr" style="grid-template-columns:0.7fr 0.9fr 1.6fr 0.6fr"><span class="amt">$29</span><span>Stripe</span><span class="c1">mia@example.com</span><span class="tm right">2h</span></div>
                <div class="tr" style="grid-template-columns:0.7fr 0.9fr 1.6fr 0.6fr"><span class="amt">$8</span><span>Stripe</span><span class="c1">leo@example.com</span><span class="tm right">3h</span></div>
                <div class="tr" style="grid-template-columns:0.7fr 0.9fr 1.6fr 0.6fr"><span class="amt">$24</span><span>Stripe</span><span class="c1">ava@example.com</span><span class="tm right">9h</span></div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="ch"><span class="eye">Users</span><h3>Account signups</h3></div>
            <div class="cb">
              <div class="log">
                <div class="th" style="grid-template-columns:1.8fr 0.8fr 0.6fr"><span>Email</span><span>Via</span><span class="right">When</span></div>
                <div class="tr" style="grid-template-columns:1.8fr 0.8fr 0.6fr"><span class="c1">new@user.com</span><span>Discord</span><span class="tm right">1h</span></div>
                <div class="tr" style="grid-template-columns:1.8fr 0.8fr 0.6fr"><span class="c1">jess@user.com</span><span>Email</span><span class="tm right">4h</span></div>
                <div class="tr" style="grid-template-columns:1.8fr 0.8fr 0.6fr"><span class="c1">kyle@user.com</span><span>Google</span><span class="tm right">7h</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Admin audit log -->
        <div class="card" style="margin-top:16px">
          <div class="ch"><span class="eye">Accountability</span><h3>Admin audit log</h3><span class="mut">who changed what</span></div>
          <div class="cb">
            <div class="log">
              <div class="th" style="grid-template-columns:1.3fr 1.1fr 1.3fr 0.6fr"><span>Action</span><span>Admin</span><span>Target</span><span class="right">When</span></div>
              <div class="tr" style="grid-template-columns:1.3fr 1.1fr 1.3fr 0.6fr"><span class="c1">Token created</span><span>everant00</span><span class="mn">railway-prod</span><span class="tm right">3s</span></div>
              <div class="tr" style="grid-template-columns:1.3fr 1.1fr 1.3fr 0.6fr"><span class="c1">Price updated</span><span>everant00</span><span>Protection · $29</span><span class="tm right">1h</span></div>
              <div class="tr" style="grid-template-columns:1.3fr 1.1fr 1.3fr 0.6fr"><span class="c1">Support code redeemed</span><span>everett</span><span class="mn">mia@example.com</span><span class="tm right">2d</span></div>
              <div class="tr" style="grid-template-columns:1.3fr 1.1fr 1.3fr 0.6fr"><span class="c1">Marketing disabled</span><span>everant00</span><span>storefront</span><span class="tm right">3d</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- ───── SUPER ADMIN ───── -->
      <div id="super-content" style="display:none">
        <div class="scols" style="grid-template-columns:1fr 1.25fr;align-items:start">
          <!-- Admins -->
          <div class="card">
            <div class="ch"><span class="eye">Team</span><h3>Admins</h3></div>
            <div class="cb">
              <label class="lbl">Add admin by email</label>
              <div class="redeem">
                <input class="in" placeholder="person@example.com">
                <button class="btn"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Grant</button>
              </div>

              <div class="listcap">People</div>
              <div class="adm" data-email="everant00@gmail.com" data-role="Owner · all access">
                <div class="av">E</div>
                <div><div class="em">everant00@gmail.com <span class="tag g">super</span></div><div class="ro">Owner · full access</div></div>
              </div>
              <div class="adm sel" data-email="everetth.inquiries@gmail.com" data-role="Admin">
                <div class="av">E</div>
                <div><div class="em">everetth.inquiries@gmail.com <span class="tag a">admin</span></div><div class="ro">Admin · limited</div></div>
                <span class="ic x"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span>
              </div>
              <div class="adm" data-email="jordan@example.com" data-role="Admin">
                <div class="av">J</div>
                <div><div class="em">jordan@example.com <span class="tag a">admin</span></div><div class="ro">Admin · limited</div></div>
                <span class="ic x"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></span>
              </div>
            </div>
          </div>

          <!-- Access control -->
          <div class="card">
            <div class="ch"><span class="eye">Permissions</span><h3>Access</h3><span class="mut">what this admin can see</span></div>
            <div class="cb">
              <div class="permhead"><span class="pe" id="perm-name">everetth.inquiries@gmail.com</span></div>
              <div class="subnote" style="margin-bottom:8px">Toggle which sections of the admin panel this person can open.</div>

              <div class="permrow"><div><div class="pt">Overview</div><div class="pd">Stats &amp; funnel</div></div><span class="sw on"><i></i></span></div>
              <div class="permrow"><div><div class="pt">Storefront</div><div class="pd">Codes, billing override, announcements</div></div><span class="sw on"><i></i></span></div>
              <div class="permrow"><div><div class="pt">Bots &amp; Workers</div><div class="pd">Secrets, token pool, worker tokens</div></div><span class="sw"><i></i></span></div>
              <div class="permrow"><div><div class="pt">Support Access</div><div class="pd">Redeem codes, customer lookup</div></div><span class="sw on"><i></i></span></div>
              <div class="permrow"><div><div class="pt">Logs &amp; history</div><div class="pd">Orders, purchases, signups, audit</div></div><span class="sw on"><i></i></span></div>
              <div class="permrow"><div><div class="pt">Super admin</div><div class="pd">Manage admins &amp; access — owner only</div></div><span class="sw lock"><i></i></span></div>
              <div class="permrow"><div><div class="pt">Danger zone</div><div class="pd">Kill switches, reset — owner only</div></div><span class="sw lock"><i></i></span></div>

              <button class="btn" style="margin-top:14px"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>Save access</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ───── CAPTCHA IMAGES ───── -->
      <div id="captcha-content" style="display:none">
        <div class="card">
          <div class="ch"><span class="eye">Verification</span><h3>Captcha images</h3><span class="mut">shared pool for image-captcha bots</span></div>
          <div class="cb">
            <div class="minis">
              <div class="mini"><div class="l">Images</div><div class="v">24</div></div>
              <div class="mini"><div class="l">Used by</div><div class="v">3 <span style="font-size:12px;color:var(--faint)">bots</span></div></div>
              <div class="mini"><div class="l">Solved · 24h</div><div class="v">418</div></div>
            </div>

            <div class="drop">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
              <div class="dt">Drag images here, or browse</div>
              <div class="ds">PNG or JPG · you'll set the answer for each after upload</div>
            </div>

            <div class="listcap">Pool</div>
            <div class="capgrid">
              <div class="capcard"><div class="capimg"><span class="txt">7F3KQ</span></div><div class="capmeta"><span class="ans">7F3KQ</span><button class="del"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>
              <div class="capcard"><div class="capimg"><span class="txt">A92XP</span></div><div class="capmeta"><span class="ans">A92XP</span><button class="del"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>
              <div class="capcard"><div class="capimg"><span class="txt">M4T8B</span></div><div class="capmeta"><span class="ans">M4T8B</span><button class="del"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>
              <div class="capcard"><div class="capimg"><span class="txt">Z6WQ1</span></div><div class="capmeta"><span class="ans">Z6WQ1</span><button class="del"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>
              <div class="capcard"><div class="capimg"><span class="txt">K3RJ9</span></div><div class="capmeta"><span class="ans">K3RJ9</span><button class="del"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>
              <div class="capcard"><div class="capimg"><span class="txt">PX72C</span></div><div class="capmeta"><span class="ans">PX72C</span><button class="del"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>
            </div>
            <div class="subnote" style="margin-top:13px">Only appears when a bot uses image-captcha verification. Answers are stored with each image so bots can check them.</div>
          </div>
        </div>
      </div>

      <!-- ───── DANGER ZONE ───── -->
      <div id="danger-content" class="dz" style="display:none">
        <!-- Market -->
        <div class="card" style="margin-bottom:16px">
          <div class="ch"><span class="eye">Storefront</span><h3>Market</h3><span class="mut">controls whether people can buy</span></div>
          <div class="cb">
            <div class="lbl2">Market is active <span class="pill-live">accepting purchases</span></div>
            <div class="subnote" style="margin-top:6px">When off, customers can't place purchases or preorders — the store shows as closed. Requires your admin code.</div>
            <div class="confirm">
              <input class="in mono" type="password" placeholder="enter admin code to change">
              <button class="btn danger"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>Close market</button>
            </div>
          </div>
        </div>

        <!-- Emergency stop all bots -->
        <div class="card">
          <div class="ch"><span class="eye">Emergency</span><h3>Stop all bots</h3><span class="mut">kill switch</span></div>
          <div class="cb">
            <div class="statusline"><span class="pdot"></span> 37 bots online</div>
            <div class="subnote">
              Takes <b style="color:var(--body)">every</b> bot offline immediately. They stay in their servers — nothing is removed or kicked — they just go down until you bring them back. Use only if something is seriously wrong. Requires your admin code.
            </div>
            <div class="confirm">
              <input class="in mono" type="password" placeholder="enter admin code to confirm">
              <button class="btn danger big"><svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>Stop all bots</button>
            </div>
            <div class="subnote" style="margin-top:11px">After stopping, a <b style="color:var(--ok)">Bring all back online</b> button appears here to restore the fleet.</div>
          </div>
        </div>
      </div>

      <!-- ───── placeholder for the other sections ───── -->
      <div class="stage" id="stage" style="display:none">
        <div>
          <div class="big" id="stage-title">Storefront</div>
          <div class="small">Boxes for this section get added here, one at a time.</div>
        </div>
      </div>
    </div>
  </div>
</div>`;

const ADMIN_JS = `// segmented toggles (generic: click sets .on within the group)
  document.querySelectorAll('.seg').forEach(function(seg){
    seg.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click', function(){
        seg.querySelectorAll('button').forEach(function(x){x.classList.remove('on')});
        b.classList.add('on');
        if (seg.id === 'dest') {
          var df = document.getElementById('dashfields');
          if (df) df.style.display = b.getAttribute('data-dash') === '0' ? 'none' : 'block';
        }
      });
    });
  });

  // permission switches
  document.querySelectorAll('.sw:not(.lock)').forEach(function(s){
    s.addEventListener('click', function(){ s.classList.toggle('on'); });
  });
  // admin select
  document.querySelectorAll('.adm').forEach(function(a){
    a.addEventListener('click', function(e){
      if (e.target.closest('.x')) return;
      document.querySelectorAll('.adm').forEach(function(x){x.classList.remove('sel')});
      a.classList.add('sel');
      var pn = document.getElementById('perm-name');
      if (pn) pn.textContent = a.getAttribute('data-email');
    });
  });

  // category filter chips
  document.querySelectorAll('.chips .chip:not(.add)').forEach(function(c){
    c.addEventListener('click', function(){
      var row = c.parentElement;
      row.querySelectorAll('.chip:not(.add)').forEach(function(x){x.classList.remove('on')});
      c.classList.add('on');
    });
  });

  document.querySelectorAll('.nav[data-sec]').forEach(function(n){
    n.addEventListener('click', function(){
      document.querySelectorAll('.nav[data-sec]').forEach(function(x){x.classList.remove('on')});
      n.classList.add('on');
      var sec = n.getAttribute('data-sec');
      document.getElementById('crumb').innerHTML = sec;
      document.getElementById('title').innerHTML = sec;
      document.getElementById('sub').textContent = n.getAttribute('data-sub');
      var map = { 'Overview': 'overview-content', 'Storefront': 'storefront-content', 'Bots & Workers': 'bots-content', 'Support Access': 'support-content', 'Logs & history': 'logs-content', 'Super admin': 'super-content', 'Captcha images': 'captcha-content', 'Danger zone': 'danger-content' };
      ['overview-content','storefront-content','bots-content','support-content','logs-content','super-content','captcha-content','danger-content'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.style.display = 'none';
      });
      var cid = map[sec];
      if (cid && document.getElementById(cid)) {
        document.getElementById(cid).style.display = 'block';
        document.getElementById('stage').style.display = 'none';
      } else {
        document.getElementById('stage').style.display = 'grid';
        document.getElementById('stage-title').innerHTML = sec;
      }
      window.scrollTo(0,0);
    });
  });`;

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  const doSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isAdmin) return;

    // background image (imported asset → hashed URL)
    const bg = root.querySelector<HTMLElement>(".osd-bg");
    if (bg) bg.style.backgroundImage = `url(${containers})`;

    // fonts
    if (!document.getElementById("osadmin-fonts")) {
      const l = document.createElement("link");
      l.id = "osadmin-fonts";
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono&display=swap";
      document.head.appendChild(l);
    }

    // Back to website / Sign out
    root.querySelectorAll<HTMLElement>(".side .nav").forEach((n) => {
      const t = (n.textContent || "").trim();
      if (t === "Back to website") n.addEventListener("click", () => navigate("/"));
      if (t === "Sign out") n.addEventListener("click", () => setConfirmOut(true));
    });

    // section nav + small interactions (verbatim from the mockup)
    try {
      // eslint-disable-next-line no-new-func
      new Function(ADMIN_JS)();
    } catch {
      /* noop */
    }
  }, [isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center text-muted-foreground">
        Loading...
      </div>
    );
  }
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground">
            Your account isn't on the admin allowlist. Contact an administrator if you believe this is a mistake.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link to="/">Back to site</Link>
            </Button>
            <Button
              variant="hero"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth", { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="osadmin" ref={rootRef}>
      <div dangerouslySetInnerHTML={{ __html: "<style>" + ADMIN_CSS + CONFIRM_CSS + "</style>" + ADMIN_HTML }} />
      {confirmOut && (
        <div className="osa-modal" onClick={() => setConfirmOut(false)}>
          <div className="osa-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="osa-dt">Sign out?</div>
            <div className="osa-dp">You'll need to sign back in to access the admin panel.</div>
            <div className="osa-da">
              <button className="osa-btn ghost" onClick={() => setConfirmOut(false)}>Cancel</button>
              <button className="osa-btn danger" onClick={doSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CONFIRM_CSS = `
.osadmin .osa-modal{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;background:rgba(14,18,23,.62);backdrop-filter:blur(3px);animation:osa-fade .15s ease}
@keyframes osa-fade{from{opacity:0}to{opacity:1}}
.osadmin .osa-dialog{width:100%;max-width:360px;border:1px solid rgba(168,180,191,.18);border-radius:16px;background:linear-gradient(180deg,rgba(46,54,63,.98),rgba(39,46,54,.99));box-shadow:0 26px 64px -20px rgba(0,0,0,.75);padding:20px}
.osadmin .osa-dt{font-family:var(--disp);font-weight:700;color:var(--heading);font-size:17px}
.osadmin .osa-dp{font-size:13px;color:var(--faint);margin-top:6px;line-height:1.5}
.osadmin .osa-da{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.osadmin .osa-btn{border:0;border-radius:10px;padding:9px 16px;font-family:var(--bodyf);font-weight:700;font-size:13px;cursor:pointer;transition:.15s}
.osadmin .osa-btn.ghost{background:transparent;color:var(--heading);border:1px solid rgba(168,180,191,.22)}
.osadmin .osa-btn.ghost:hover{background:rgba(232,238,243,.06)}
.osadmin .osa-btn.danger{background:#e08a8a;color:#2a1213}
.osadmin .osa-btn.danger:hover{filter:brightness(1.06)}
`;

export default Admin;
