#!/usr/bin/env node
/** Generate audited browser derivatives. Never writes source archives or CSVs. */
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const out = process.argv[3] || 'src/generated/real-backtests.ts';
if (!root) throw new Error('Usage: node scripts/generate-v2b-real-data.mjs <extracted-directory> [output.ts]');
const stochDir = path.join(root, 'stoch', 'STOCHEXTREME');
const triDir = path.join(root, 'triangle');
function csv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
  const parse = (line) => { const a=[]; let v='', q=false; for (let i=0;i<line.length;i++) { const c=line[i]; if(c==='"') { if(q&&line[i+1]==='"'){v+='"';i++;} else q=!q; } else if(c===','&&!q){a.push(v);v='';} else v+=c; } a.push(v); return a; };
  const lines=text.split(/\r?\n/); const headers=parse(lines.shift());
  return lines.filter(Boolean).map((line,n) => { const vals=parse(line); if(vals.length!==headers.length) throw new Error(`${file}:${n+2}: expected ${headers.length} columns, got ${vals.length}`); return Object.fromEntries(headers.map((h,i)=>[h,vals[i]])); });
}
const num=(x, ctx)=>{const n=Number(x);if(!Number.isFinite(n))throw new Error(`Invalid number ${ctx}: ${x}`);return n};
const iso=(time,ctx)=>{const m=/^(\d{4})\.(\d\d)\.(\d\d) (\d\d:\d\d:\d\d)$/.exec(time);if(!m)throw new Error(`Invalid UTC timestamp ${ctx}: ${time}`);return `${m[1]}-${m[2]}-${m[3]}T${m[4]}Z`};
const required=(rows, fields, file)=>{if(!rows.length)throw new Error(`${file}: no rows`);for(const f of fields)if(!(f in rows[0]))throw new Error(`${file}: missing ${f}`)};
const unique=(rows,key,file)=>{const s=new Set(rows.map(r=>r[key]));if(s.size!==rows.length)throw new Error(`${file}: duplicate ${key}`)};
const ordered=(rows,key,file)=>{for(let i=1;i<rows.length;i++)if(num(rows[i][key],file)<num(rows[i-1][key],file))throw new Error(`${file}: not ordered by ${key}`)};
const approx=(a,b,label,epsilon=.01)=>{if(Math.abs(a-b)>epsilon)throw new Error(`${label}: ${a} != ${b}`)};
function readOne(dir, suffix){const found=fs.readdirSync(dir).find(n=>n.endsWith(suffix));if(!found)throw new Error(`Missing ${suffix} in ${dir}`);return csv(path.join(dir,found));}
function reduce(points,max=1200){
 if(points.length<=max)return {points, original:points.length, retained:points.length};
 const keep=new Set([0,points.length-1]); let hi=0,lo=0,peak=points[0].equity, worst=0,peakIndex=0,valley=0,recovery=-1;
 for(let i=0;i<points.length;i++){if(points[i].equity>points[hi].equity)hi=i;if(points[i].equity<points[lo].equity)lo=i;if(points[i].equity>peak){peak=points[i].equity;peakIndex=i}if(peak-points[i].equity>worst){worst=peak-points[i].equity;valley=i;}}
 for(let i=valley+1;i<points.length;i++)if(points[i].equity>=points[peakIndex].equity){recovery=i;break}
 [hi,lo,peakIndex,valley,recovery].filter(i=>i>=0).forEach(i=>keep.add(i));
 points.forEach((p,i)=>{if(i>0&&p.tradeId!==points[i-1].tradeId)keep.add(i);});
 const slots=Math.max(1,max-keep.size);for(let i=0;i<slots;i++)keep.add(Math.round(i*(points.length-1)/Math.max(1,slots-1)));
 return {points:[...keep].sort((a,b)=>a-b).map(i=>points[i]),original:points.length,retained:keep.size};
}
function monthly(trades){const m=new Map;for(const t of trades){const d=t.closedAt.slice(0,7);const x=m.get(d)||{month:d,pnlUsd:0,trades:0};x.pnlUsd+=t.pnlUsd;x.trades++;m.set(d,x)}return [...m.values()]}
const manifest=readOne(stochDir,'_manifest.csv')[0], config=readOne(stochDir,'_strategy_config.csv')[0], spec=readOne(stochDir,'_symbol_specifications.csv')[0], coverage=readOne(stochDir,'_coverage.csv')[0];
const st=readOne(stochDir,'_trades.csv'), se=readOne(stochDir,'_equity.csv'), ev=readOne(stochDir,'_events.csv');
const ST='SEA2575_AMP_@ENQ_1754006400';
required(st,['trade_id','run_id','direction','entry_time','entry_time_msc','exit_time','exit_time_msc','net_pnl','r_multiple','structural_outcome','exit_reason','symbol'],'stoch trades');unique(st,'trade_id','stoch trades');unique(st,'position_id','stoch trades');ordered(st,'entry_time_msc','stoch trades');ordered(st,'exit_time_msc','stoch trades');
for(const r of st)if(r.run_id!==ST||r.symbol!=='@ENQ')throw new Error('Stoch run/symbol mismatch');
if(manifest.run_id!==ST||config.run_id!==ST||spec.run_id!==ST||coverage.run_id!==ST)throw new Error('Stoch run id mismatch');
if(manifest.status!=='COMPLETED'||manifest.warnings!=='none'||manifest.closed_trades!=='421')throw new Error('Stoch manifest status/warnings/trade control mismatch');
if(config.server_utc_offset_hours!=='0'||config.ny_dst_enabled!=='true'||config.stop_price_distance!=='100.0')throw new Error('Stoch UTC/DST/stop configuration mismatch');
if(spec.broker!=='AMP Global Clearing LLC'||spec.server!=='AMPGlobalUSA-Live'||spec.symbol!=='@ENQ'||spec.account_currency!=='USD')throw new Error('Stoch broker/server/spec mismatch');
if(coverage.last_tick!==manifest.end_time||coverage.warmup_complete!=='true')throw new Error('Stoch coverage mismatch');
const stochTrades=st.map(r=>({id:`stoch-${r.trade_id}`,side:r.direction==='BUY'?'buy':'sell',openedAt:iso(r.entry_time,`trade ${r.trade_id}`),closedAt:iso(r.exit_time,`trade ${r.trade_id}`),symbol:'@ENQ',quantity:num(r.volume,'volume'),entryPrice:num(r.entry_price,'entry'),exitPrice:num(r.exit_price,'exit'),pnlUsd:num(r.net_pnl,'pnl'),feesUsd:num(r.commission,'commission')+num(r.swap,'swap'),structural:r.structural_outcome==='WIN'?'win':'loss',rMultiple:num(r.r_multiple,'r'),exitReason:r.exit_reason,structuralRule:r.structural_outcome}));
for(const r of stochTrades){if(r.structural==='win'&&!((r.side==='buy'&&r.exitReason==='TARGET_K80_M30_CLOSE')||(r.side==='sell'&&r.exitReason==='TARGET_K20_M30_CLOSE')))throw new Error(`Stoch structural win rule failed ${r.id}`);if(r.structural==='loss'&&r.exitReason!=='SL')throw new Error(`Stoch structural loss rule failed ${r.id}`)}
approx(stochTrades.reduce((a,t)=>a+t.pnlUsd,0),6582,'Stoch PnL');approx(stochTrades.reduce((a,t)=>a+t.rMultiple,0),32.91,'Stoch R');
required(se,['time','time_msc','balance','equity','drawdown_absolute','active_position','trade_id'],'stoch equity');unique(se,'time_msc','stoch equity');ordered(se,'time_msc','stoch equity');if(se.at(-1).active_position!=='NONE')throw new Error('Stoch has open position at end');
let peak=-Infinity,dd=0; const fullStoch=se.map(r=>{const x={timestamp:iso(r.time,'equity'),equity:num(r.equity,'equity'),balance:num(r.balance,'balance'),drawdownUsd:num(r.drawdown_absolute,'dd'),tradeId:r.trade_id};peak=Math.max(peak,x.equity);dd=Math.max(dd,peak-x.equity);return x});approx(dd,4690,'Stoch max DD');
const stochReduced=reduce(fullStoch);
const tManifest=JSON.parse(fs.readFileSync(path.join(triDir,'first_triangle_web_manifest.json'),'utf8'));const ts=csv(path.join(triDir,'first_triangle_web_summary.csv'))[0], tt=csv(path.join(triDir,'first_triangle_web_trades.csv')), te=csv(path.join(triDir,'first_triangle_web_equity.csv'));
const TR='QUANTORA_FIRST_TRIANGLE_FINAL15_@ENQ_1754006400';if(tManifest.source_run_id!==TR||tManifest.selected_branch_id!==5||String(ts.branch_id)!=='5')throw new Error('First Triangle run/branch mismatch');if(tt.some(r=>r.run_id!==TR||r.branch_id!=='5'))throw new Error('First Triangle includes non-branch-5 trade');required(tt,['trade_id','entry_time','entry_time_msc','exit_time','exit_time_msc','net_usd','r_multiple','direction','risk_points'],'triangle trades');unique(tt,'trade_id','triangle trades');ordered(tt,'entry_time_msc','triangle trades');ordered(tt,'exit_time_msc','triangle trades');
const triangleTrades=tt.map(r=>({id:`triangle-${r.trade_id}`,side:r.direction==='BUY'?'buy':'sell',openedAt:iso(r.entry_time,`triangle ${r.trade_id}`),closedAt:iso(r.exit_time,`triangle ${r.trade_id}`),symbol:'@ENQ',quantity:1,entryPrice:num(r.entry_price,'entry'),exitPrice:num(r.exit_price,'exit'),pnlUsd:num(r.net_usd,'pnl'),feesUsd:num(r.cost_usd,'cost'),rMultiple:num(r.r_multiple,'r'),exitReason:r.exit_reason,riskPoints:num(r.risk_points,'risk')}));
approx(triangleTrades.reduce((a,t)=>a+t.pnlUsd,0),6687.5,'Triangle PnL');approx(triangleTrades.reduce((a,t)=>a+t.rMultiple,0),17.15375,'Triangle R');if(tt.length!==145||ts.open_at_end!=='False'||tManifest.metrics.open_at_end!==false)throw new Error('Triangle trade/open control mismatch');
required(te,['exit_time','exit_time_msc','equity_usd','drawdown_usd'],'triangle equity');unique(te,'exit_time_msc','triangle equity');ordered(te,'exit_time_msc','triangle equity');let triPeak=0,triDd=0;const fullTri=te.map(r=>{const x={timestamp:iso(r.exit_time,'triangle equity'),equity:num(r.equity_usd,'equity'),balance:num(r.equity_usd,'equity'),drawdownUsd:num(r.drawdown_usd,'dd'),tradeId:r.trade_id};triPeak=Math.max(triPeak,x.equity);triDd=Math.max(triDd,triPeak-x.equity);return x});approx(triDd,4151.5,'Triangle closed-trade DD');
const triReduced=reduce(fullTri);
const data={
 generatedFrom:'Immutable data/quantora-real-backtests archives; see docs/REAL_BACKTEST_AUDIT.md',
 stochExtreme:{runId:ST,publicMarket:'Nasdaq-100',historicalInstrument:'AMP @ENQ',broker:'AMP Global Clearing LLC',server:'AMPGlobalUSA-Live',period:{start:manifest.start_time,end:manifest.end_time},config:{version:config.version,calculationMode:config.calculation_mode,entryModel:config.entry_model,stopPoints:num(config.stop_price_distance,'stop'),serverUtcOffsetHours:0,nyDstEnabled:true,allowedEt:config.allowed_et_windows,blockedEt:config.blocked_et_windows},controls:{trades:421,netUsd:6582,profitFactor:num(manifest.profit_factor,'pf'),officialDrawdownUsd:4690,officialDrawdownPct:num(manifest.max_drawdown_percent,'ddpct'),structuralWins:200,structuralLosses:221,openAtEnd:false,warnings:manifest.warnings,ticks:num(manifest.ticks_processed,'ticks')},trades:stochTrades,equity:stochReduced.points,equityReduction:{algorithm:'uniform + first/last + global high/low + max-drawdown peak/valley/recovery + every trade-id change',originalPoints:stochReduced.original,finalPoints:stochReduced.retained},monthly:monthly(stochTrades)},
 firstTriangleBranch5:{runId:TR,branchId:5,publicMarket:'Nasdaq-100',historicalInstrument:'@ENQ',period:{start:triangleTrades[0].openedAt,end:triangleTrades.at(-1).closedAt},config:{entry:tManifest.selection.entry_model,stop:tManifest.selection.stop_mode,exit:tManifest.selection.exit_mode},controls:{trades:145,wins:74,losses:71,netUsd:6687.5,netR:17.15375,profitFactor:1.25593,expectancyUsd:46.12068965517251,officialDrawdownUsd:4474.8,closedTradeDrawdownUsd:4151.5,openAtEnd:false},trades:triangleTrades,equity:triReduced.points,equityReduction:{algorithm:'all points retained (under cap)',originalPoints:triReduced.original,finalPoints:triReduced.retained},monthly:monthly(triangleTrades)}
};
const file=`/* AUTO-GENERATED by scripts/generate-v2b-real-data.mjs. Do not hand edit. Source archives are never bundled. */\nexport const REAL_BACKTESTS = ${JSON.stringify(data,null,2)} as const;\n`;
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,file);
console.log(`Generated ${out}: ${stochTrades.length} Stoch trades, ${triangleTrades.length} First Triangle branch 5 trades; equity ${stochReduced.original}->${stochReduced.retained}, ${triReduced.original}->${triReduced.retained}.`);
