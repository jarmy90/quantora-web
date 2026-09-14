//+------------------------------------------------------------------+
//| Quantora_FirstTriangle_GOLD_M15_FINAL_v3_21.mq5                          |
//| Production EA - First alternating triangle entry (XAUUSD/GOLD M15)  |
//| Port of TAV2-ST-QQE concept: Trend Cloud + Supertrend + QQE Mod  |
//|                                                                    |
//| EXIT LOGIC (v1.00 change vs prior "wait for opposite signal"):    |
//|  - PRIMARY exit  : Adaptive MFE-Giveback stop                     |
//|      MFE>=200pts -> giveback 150pts (lock = MFE-150)              |
//|      MFE>=400pts -> giveback 200pts (lock = MFE-200)              |
//|      MFE>=700pts -> giveback 250pts (lock = MFE-250)              |
//|  - FALLBACK exit : opposite alternating triangle (emergency exit, |
//|      only fires if MFE-giveback never triggered a close first)    |
//|  - Initial protective stop: fixed InpStopPoints (default 200)     |
//|                                                                    |
//| Rationale (validated on M30/SL200 branch backtest):                |
//|   Opposite-signal exits: 14% of trades, 35% WR, net -$1,808        |
//|   MFE-giveback exits   : 46% of trades, 100% WR, net +$31,766      |
//|                                                                    |
//| Signals are confirmed at M15 close; entry is next bar tick.        |
//| Stops/giveback are evaluated tick by tick.                         |
//+------------------------------------------------------------------+
#property copyright "Quantora MT5 | www.quantoramt5.com"
#property link      "https://www.quantoramt5.com"
#property version   "3.22"
#property strict
#include <Trade/Trade.mqh>
CTrade g_trade;

//--------------------------- Inputs ---------------------------------
input group "Market and execution"
input ENUM_TIMEFRAMES InpTF                 = PERIOD_M15;
input group "Dynamic balance-based volume"
input bool            InpUseDynamicVolume   = true;
input double          InpBaseVolume         = 0.02;    // por cada bloque completo de saldo
input double          InpBalanceStep        = 1000.0;  // moneda de la cuenta
input double          InpMaximumVolume      = 0.0;     // 0 = maximo permitido por broker
input double          InpFixedVolume        = 0.02;    // usado si se desactiva el modo dinamico
input int             InpWarmupBars         = 350;
input bool            InpAllowLong          = true;
input bool            InpAllowShort         = true;

input group "Trend cloud"
input int             InpCloudPeriod        = 52;
input int             InpCloudSmooth        = 10;

input group "Supertrend"
input int             InpATRPeriod          = 10;
input double          InpATRMultiplier      = 3.0;

input group "QQE Mod"
input int             InpRSIPeriod1         = 6;
input int             InpRSISmooth1         = 5;
input double          InpQQEFactor1         = 3.0;
input int             InpBBLength           = 50;
input double          InpBBMultiplier       = 0.35;
input int             InpRSIPeriod2         = 6;
input int             InpRSISmooth2         = 5;
input double          InpQQEFactor2         = 1.61;
input double          InpQQEThreshold2      = 3.0;

input group "Initial protective stop"
input double          InpStopPoints          = 55.0;   // fixed SL in index points

input group "Validated GOLD trailing (PRIMARY exit)"
input double          InpTrailActivationPoints = 60.0;
input double          InpTrailDistancePoints   = 25.0;
input group "Opposite-triangle exit (FALLBACK only)"
input bool             InpEnableOppositeFallback = true; // emergency exit if MFE-giveback never triggers

input group "Execution / misc"
input string           InpRunLabel           = "FIRST_TRIANGLE_GOLD_M15_FINAL";
input ulong             InpMagic              = 257522;
input int               InpDeviationTicks     = 4;
input bool               InpWriteTradeLog      = true;   // simple trade CSV, optional
input bool               InpShowComment        = true;
input bool               InpDrawSignalArrows   = true;
input int                InpArrowHistoryBars   = 250;
input color              InpBuyArrowColor      = clrLime;
input color              InpSellArrowColor     = clrRed;

#define MAX_CALC_BARS 700

struct IndicatorState
  {
   datetime bar_time;
   double open,high,low,close;
   double atr;
   bool cloud_bull;
   int st_dir;
   double st_line;
   bool qqe_blue;
   bool qqe_red;
   bool full_long;
   bool full_short;
  };

//-------------------------- Position state ---------------------------
bool     g_active=false;
ulong    g_position_id=0;
long     g_trade_id=1;
int      g_dir=0;
datetime g_signal_time=0, g_entry_time=0;
double   g_entry_price=0.0, g_initial_stop=0.0, g_active_stop=0.0;
double   g_risk_points=0.0, g_mfe_points=0.0, g_mae_points=0.0;
bool     g_giveback_applied=false;

IndicatorState g_cur,g_prev;
datetime g_last_bar=0;
int      g_bars_seen=0;
long     g_ticks=0,g_signal_id=1;
string   g_run_id="";
int      f_trades=INVALID_HANDLE;
int      g_cycle_side=0; // 0 neutral, +1 last accepted Buy triangle, -1 last accepted Sell triangle

//-------------------------- Utilities --------------------------------
string B(bool v){ return v ? "true" : "false"; }
string D(int d){ return d>0 ? "BUY" : d<0 ? "SELL" : "NONE"; }
double TickSize()
  {
   double x=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   return x>0 ? x : SymbolInfoDouble(_Symbol,SYMBOL_POINT);
  }
double NormTick(double p)
  {
   double t=TickSize();
   return NormalizeDouble(MathRound(p/t)*t,(int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS));
  }
int VolumeDigits(double step)
  {
   int d=0;
   while(d<8 && MathAbs(step-NormalizeDouble(step,d))>1e-12) d++;
   return d;
  }
double NormalizeVolumeDown(double requested)
  {
   double mn=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double mx=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double st=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   if(mn<=0.0 || mx<=0.0 || st<=0.0) return 0.0;
   double cap=MathMin(requested,mx);
   if(InpMaximumVolume>0.0) cap=MathMin(cap,InpMaximumVolume);
   if(cap<mn) return 0.0;
   double volume=mn+MathFloor((cap-mn+1e-12)/st)*st;
   return NormalizeDouble(MathMin(volume,mx),VolumeDigits(st));
  }
double CalculateEntryVolume()
  {
   double balance=AccountInfoDouble(ACCOUNT_BALANCE);
   int blocks=1;
   double requested=InpFixedVolume;
   if(InpUseDynamicVolume)
     {
      blocks=(int)MathFloor(balance/InpBalanceStep+1e-12);
      if(blocks<1) blocks=1;
      requested=InpBaseVolume*blocks;
     }
   double volume=NormalizeVolumeDown(requested);
   Print("FIRST TRIANGLE GOLD VOLUME CALCULATED balance=",DoubleToString(balance,2),
         " currency=",AccountInfoString(ACCOUNT_CURRENCY)," blocks=",blocks,
         " requested=",DoubleToString(requested,4)," normalized=",DoubleToString(volume,4));
   return volume;
  }
int OpenCsv(string suffix)
  {
   return FileOpen("Quantora_"+g_run_id+"_"+suffix+".csv",
                   FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,',');
  }

//---------------------- Math / series helpers ------------------------
double SMA(const double &a[],int i,int n)
  {
   if(i<n-1) return EMPTY_VALUE;
   double s=0; for(int k=i-n+1;k<=i;k++) s+=a[k];
   return s/n;
  }
double VWMA(const double &src[],const long &vol[],int i,int n)
  {
   if(i<n-1) return EMPTY_VALUE;
   double sv=0,sw=0;
   for(int k=i-n+1;k<=i;k++){ double w=(double)MathMax((long)1,vol[k]); sv+=src[k]*w; sw+=w; }
   return sw>0 ? sv/sw : EMPTY_VALUE;
  }
double StDevPopulation(const double &a[],int i,int n)
  {
   if(i<n-1) return EMPTY_VALUE;
   double mean=0; for(int k=i-n+1;k<=i;k++) mean+=a[k]; mean/=n;
   double ss=0; for(int k=i-n+1;k<=i;k++){ double d=a[k]-mean; ss+=d*d; }
   return MathSqrt(ss/n);
  }
void EMA(const double &src[],double &out[],int n,int total)
  {
   double alpha=2.0/(n+1.0); out[0]=src[0];
   for(int i=1;i<total;i++) out[i]=alpha*src[i]+(1.0-alpha)*out[i-1];
  }
void RMA(const double &src[],double &out[],int n,int total)
  {
   out[0]=src[0];
   for(int i=1;i<total;i++) out[i]=(out[i-1]*(n-1)+src[i])/n;
  }
void RSI(const double &close[],double &out[],int n,int total)
  {
   double up[],dn[],au[],ad[];
   ArrayResize(up,total); ArrayResize(dn,total); ArrayResize(au,total); ArrayResize(ad,total);
   up[0]=0;dn[0]=0;
   for(int i=1;i<total;i++)
     { double ch=close[i]-close[i-1]; up[i]=MathMax(ch,0.0); dn[i]=MathMax(-ch,0.0); }
   RMA(up,au,n,total); RMA(dn,ad,n,total);
   for(int i=0;i<total;i++)
     {
      if(ad[i]<=1e-12) out[i]=au[i]<=1e-12 ? 50.0 : 100.0;
      else { double rs=au[i]/ad[i]; out[i]=100.0-100.0/(1.0+rs); }
     }
  }
bool CrossAny(double a_prev,double a_now,double b_prev,double b_now)
  { return (a_prev<=b_prev && a_now>b_now) || (a_prev>=b_prev && a_now<b_now); }

//--------------------- Indicator reconstruction (unchanged signal engine) ----------------------
bool CalculateClosedStateAtShift(int closed_shift,IndicatorState &out,IndicatorState &prev_out)
  {
   int request=MAX_CALC_BARS;
   MqlRates rr[]; ArraySetAsSeries(rr,true);
   int copied=CopyRates(_Symbol,InpTF,closed_shift,request,rr);
   int min_need=MathMax(InpCloudPeriod+InpCloudSmooth+50,250);
   if(copied<min_need) return false;

   int n=copied;
   double o[],h[],l[],c[],tr[],atr[]; long vol[]; datetime tm[];
   ArrayResize(o,n);ArrayResize(h,n);ArrayResize(l,n);ArrayResize(c,n);
   ArrayResize(tr,n);ArrayResize(atr,n);ArrayResize(vol,n);ArrayResize(tm,n);
   for(int i=0;i<n;i++)
     {
      int z=n-1-i; o[i]=rr[z].open;h[i]=rr[z].high;l[i]=rr[z].low;c[i]=rr[z].close;
      vol[i]=rr[z].tick_volume;tm[i]=rr[z].time;
      double pc=i>0?c[i-1]:c[i];
      tr[i]=MathMax(h[i]-l[i],MathMax(MathAbs(h[i]-pc),MathAbs(l[i]-pc)));
     }
   RMA(tr,atr,InpATRPeriod,n);

   double haC[],haO[],haC1[],haO1[],haCs[],haOs[];
   ArrayResize(haC,n);ArrayResize(haO,n);ArrayResize(haC1,n);ArrayResize(haO1,n);
   ArrayResize(haCs,n);ArrayResize(haOs,n);
   for(int i=0;i<n;i++)
     {
      haC[i]=(o[i]+h[i]+l[i]+c[i])/4.0;
      haO[i]=i==0 ? (o[i]+c[i])/2.0 : (haO[i-1]+haC[i-1])/2.0;
      haC1[i]=VWMA(haC,vol,i,InpCloudPeriod);
      haO1[i]=VWMA(haO,vol,i,InpCloudPeriod);
      if(haC1[i]==EMPTY_VALUE) haC1[i]=haC[i];
      if(haO1[i]==EMPTY_VALUE) haO1[i]=haO[i];
      haCs[i]=VWMA(haC1,vol,i,InpCloudSmooth);
      haOs[i]=VWMA(haO1,vol,i,InpCloudSmooth);
      if(haCs[i]==EMPTY_VALUE) haCs[i]=haC1[i];
      if(haOs[i]==EMPTY_VALUE) haOs[i]=haO1[i];
     }

   double up[],dn[]; int st[];
   ArrayResize(up,n);ArrayResize(dn,n);ArrayResize(st,n);
   for(int i=0;i<n;i++)
     {
      double src=(h[i]+l[i])/2.0;
      double rawUp=src-InpATRMultiplier*atr[i];
      double rawDn=src+InpATRMultiplier*atr[i];
      if(i==0){ up[i]=rawUp;dn[i]=rawDn;st[i]=1; }
      else
        {
         up[i]=(c[i-1]>up[i-1]) ? MathMax(rawUp,up[i-1]) : rawUp;
         dn[i]=(c[i-1]<dn[i-1]) ? MathMin(rawDn,dn[i-1]) : rawDn;
         st[i]=st[i-1];
         if(st[i-1]==-1 && c[i]>dn[i-1]) st[i]=1;
         else if(st[i-1]==1 && c[i]<up[i-1]) st[i]=-1;
        }
     }

   double rsi1[],rsi2[],rma1[],rma2[];
   ArrayResize(rsi1,n);ArrayResize(rsi2,n);ArrayResize(rma1,n);ArrayResize(rma2,n);
   RSI(c,rsi1,InpRSIPeriod1,n); RSI(c,rsi2,InpRSIPeriod2,n);
   EMA(rsi1,rma1,InpRSISmooth1,n); EMA(rsi2,rma2,InpRSISmooth2,n);

   double abs1[],maAbs1[],maAbs12[],dar1[],lb1[],sb1[],fast1[],center1[];
   double abs2[],maAbs2[],maAbs22[],dar2[],lb2[],sb2[],fast2[];
   int qtrend1[],qtrend2[];
   ArrayResize(abs1,n);ArrayResize(maAbs1,n);ArrayResize(maAbs12,n);ArrayResize(dar1,n);
   ArrayResize(lb1,n);ArrayResize(sb1,n);ArrayResize(fast1,n);ArrayResize(center1,n);ArrayResize(qtrend1,n);
   ArrayResize(abs2,n);ArrayResize(maAbs2,n);ArrayResize(maAbs22,n);ArrayResize(dar2,n);
   ArrayResize(lb2,n);ArrayResize(sb2,n);ArrayResize(fast2,n);ArrayResize(qtrend2,n);
   abs1[0]=0;abs2[0]=0;
   for(int i=1;i<n;i++){abs1[i]=MathAbs(rma1[i]-rma1[i-1]);abs2[i]=MathAbs(rma2[i]-rma2[i-1]);}
   EMA(abs1,maAbs1,InpRSIPeriod1*2-1,n); EMA(maAbs1,maAbs12,InpRSIPeriod1*2-1,n);
   EMA(abs2,maAbs2,InpRSIPeriod2*2-1,n); EMA(maAbs2,maAbs22,InpRSIPeriod2*2-1,n);
   for(int i=0;i<n;i++){dar1[i]=maAbs12[i]*InpQQEFactor1;dar2[i]=maAbs22[i]*InpQQEFactor2;}

   for(int i=0;i<n;i++)
     {
      double nlb1=rma1[i]-dar1[i],nsb1=rma1[i]+dar1[i];
      double nlb2=rma2[i]-dar2[i],nsb2=rma2[i]+dar2[i];
      if(i==0)
        { lb1[i]=nlb1;sb1[i]=nsb1;qtrend1[i]=1;lb2[i]=nlb2;sb2[i]=nsb2;qtrend2[i]=1; }
      else
        {
         lb1[i]=(rma1[i-1]>lb1[i-1] && rma1[i]>lb1[i-1])?MathMax(lb1[i-1],nlb1):nlb1;
         sb1[i]=(rma1[i-1]<sb1[i-1] && rma1[i]<sb1[i-1])?MathMin(sb1[i-1],nsb1):nsb1;
         bool crossShort1=CrossAny(rma1[i-1],rma1[i],i>1?sb1[i-2]:sb1[i-1],sb1[i-1]);
         bool crossLong1 =CrossAny(i>1?lb1[i-2]:lb1[i-1],lb1[i-1],rma1[i-1],rma1[i]);
         qtrend1[i]=crossShort1?1:crossLong1?-1:qtrend1[i-1];

         lb2[i]=(rma2[i-1]>lb2[i-1] && rma2[i]>lb2[i-1])?MathMax(lb2[i-1],nlb2):nlb2;
         sb2[i]=(rma2[i-1]<sb2[i-1] && rma2[i]<sb2[i-1])?MathMin(sb2[i-1],nsb2):nsb2;
         bool crossShort2=CrossAny(rma2[i-1],rma2[i],i>1?sb2[i-2]:sb2[i-1],sb2[i-1]);
         bool crossLong2 =CrossAny(i>1?lb2[i-2]:lb2[i-1],lb2[i-1],rma2[i-1],rma2[i]);
         qtrend2[i]=crossShort2?1:crossLong2?-1:qtrend2[i-1];
        }
      fast1[i]=(qtrend1[i]==1?lb1[i]:sb1[i]);
      fast2[i]=(qtrend2[i]==1?lb2[i]:sb2[i]);
      center1[i]=fast1[i]-50.0;
     }

   int ix=n-1,ip=n-2;
   double basis=SMA(center1,ix,InpBBLength);
   double dev=InpBBMultiplier*StDevPopulation(center1,ix,InpBBLength);
   double upper=basis+dev,lower=basis-dev;
   bool blue=(rma2[ix]-50.0>InpQQEThreshold2) && (rma1[ix]-50.0>upper);
   bool red =(rma2[ix]-50.0<-InpQQEThreshold2) && (rma1[ix]-50.0<lower);

   double basisP=SMA(center1,ip,InpBBLength);
   double devP=InpBBMultiplier*StDevPopulation(center1,ip,InpBBLength);
   bool blueP=(rma2[ip]-50.0>InpQQEThreshold2) && (rma1[ip]-50.0>basisP+devP);
   bool redP =(rma2[ip]-50.0<-InpQQEThreshold2) && (rma1[ip]-50.0<basisP-devP);

   out.bar_time=tm[ix];out.open=o[ix];out.high=h[ix];out.low=l[ix];out.close=c[ix];out.atr=atr[ix];
   out.cloud_bull=haCs[ix]>=haOs[ix];out.st_dir=st[ix];out.st_line=st[ix]==1?up[ix]:dn[ix];
   out.qqe_blue=blue;out.qqe_red=red;
   out.full_long=out.cloud_bull && out.st_dir==1 && blue;
   out.full_short=!out.cloud_bull && out.st_dir==-1 && red;

   prev_out.bar_time=tm[ip];prev_out.open=o[ip];prev_out.high=h[ip];prev_out.low=l[ip];prev_out.close=c[ip];prev_out.atr=atr[ip];
   prev_out.cloud_bull=haCs[ip]>=haOs[ip];prev_out.st_dir=st[ip];prev_out.st_line=st[ip]==1?up[ip]:dn[ip];
   prev_out.qqe_blue=blueP;prev_out.qqe_red=redP;
   prev_out.full_long=prev_out.cloud_bull && prev_out.st_dir==1 && blueP;
   prev_out.full_short=!prev_out.cloud_bull && prev_out.st_dir==-1 && redP;
   return true;
  }

bool CalculateClosedState(IndicatorState &out,IndicatorState &prev_out)
  { return CalculateClosedStateAtShift(1,out,prev_out); }

void DrawAcceptedArrow(const IndicatorState &s,int dir)
  {
   if(!InpDrawSignalArrows) return;
   string name="QFT_ACCEPTED_"+IntegerToString((long)s.bar_time)+"_"+(dir>0?"BUY":"SELL");
   if(ObjectFind(0,name)>=0) return;
   double pad=MathMax(s.atr*0.18,20.0*SymbolInfoDouble(_Symbol,SYMBOL_POINT));
   double price=dir>0?s.low-pad:s.high+pad;
   if(!ObjectCreate(0,name,OBJ_ARROW,0,s.bar_time,price))
     { Print("ARROW_CREATE_FAILED error=",GetLastError()," bar=",TimeToString(s.bar_time)); return; }
   ObjectSetInteger(0,name,OBJPROP_ARROWCODE,dir>0?233:234);
   ObjectSetInteger(0,name,OBJPROP_COLOR,dir>0?InpBuyArrowColor:InpSellArrowColor);
   ObjectSetInteger(0,name,OBJPROP_WIDTH,2);
   ObjectSetInteger(0,name,OBJPROP_BACK,false);
   ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
  }

void RebuildAlternatingSignalHistory()
  {
   g_cycle_side=0;
   int bars=MathMax(1,MathMin(InpArrowHistoryBars,500));
   int accepted=0;
   for(int shift=bars;shift>=1;shift--)
     {
      IndicatorState s,p;
      if(!CalculateClosedStateAtShift(shift,s,p)) continue;
      bool buy=InpAllowLong && s.full_long && !p.full_long;
      bool sell=InpAllowShort && s.full_short && !p.full_short;
      int dir=buy?1:sell?-1:0;
      if(dir==0 || dir==g_cycle_side) continue;
      DrawAcceptedArrow(s,dir);
      g_cycle_side=dir;
      accepted++;
     }
   ChartRedraw(0);
   Print("SIGNAL_HISTORY_REBUILT accepted=",accepted," last_side=",D(g_cycle_side),
         " bars=",bars," next_required=",g_cycle_side>0?"SELL":g_cycle_side<0?"BUY":"BUY_OR_SELL");
  }

//----------------------- Trade log (optional, simple) ---------------------------
bool CreateTradeLog()
  {
   if(!InpWriteTradeLog) return true;
   f_trades=OpenCsv("trades");
   if(f_trades==INVALID_HANDLE) return false;
   FileWrite(f_trades,"trade_id","run_id","direction","signal_time","entry_time","entry_price",
             "initial_stop","final_active_stop","risk_points","exit_time","exit_price","exit_reason",
             "points","mfe_points","mae_points","giveback_applied");
   return true;
  }

////-------------------------- Position engine ----------------------------
// Selects THIS EA's own position on _Symbol (matching magic), ignoring any
// position another EA/magic may have open on the same symbol. Plain
// PositionSelect(_Symbol) selects by symbol only, which is unsafe now that
// Other EAs may trade the same GOLD symbol under a different magic: on a
// hedging account it can read or close the WRONG EA's position, and on a
// netting account the two EAs' orders would merge into a single shared
// position instead of staying independent.
bool SelectOwnPosition(ulong &ticket, ulong want_position_id = 0)
  {
   ticket = 0;
   ulong fallback_ticket = 0;
   int matches = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic) continue;

      if(want_position_id != 0)
        {
         if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == want_position_id)
           { ticket = t; return true; }
         continue;
        }
      matches++;
      if(fallback_ticket == 0) fallback_ticket = t;
     }
   if(want_position_id != 0) return false;
   if(matches > 1)
      Alert("QUANTORA WARNING: ", matches, " posiciones propias (magic=", InpMagic,
            ") en ", _Symbol, " simultaneamente — revisa manualmente.");
   ticket = fallback_ticket;
   return ticket != 0;
  }

bool PositionOpenById(ulong position_id)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong t = PositionGetTicket(i);
      if(t == 0) continue;
      if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == position_id &&
         (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagic &&
         PositionGetString(POSITION_SYMBOL) == _Symbol)
         return true;
     }
   return false;
  }

// Detects a position that vanished WITHOUT the EA requesting the close
// (native broker SL, TP, manual close from terminal/mobile, margin call,
// etc.). Without this, g_active would stay stuck "true" forever and the
// EA would never open another trade again.
void SyncTradeState()
  {
   if(!g_active || g_position_id == 0) return;
   if(PositionOpenById(g_position_id)) return;

   double exit_price = 0.0; datetime exit_time = 0; long exit_msc = 0, deal_reason = -1;
   if(HistorySelect(g_entry_time - 86400, TimeCurrent() + 86400))
     {
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
        {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0) continue;
         if((ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID) != g_position_id) continue;
         long entry_type = (long)HistoryDealGetInteger(ticket, DEAL_ENTRY);
         if(entry_type == DEAL_ENTRY_OUT || entry_type == DEAL_ENTRY_OUT_BY || entry_type == DEAL_ENTRY_INOUT)
           {
            long tmsc = (long)HistoryDealGetInteger(ticket, DEAL_TIME_MSC);
            if(tmsc >= exit_msc)
              {
               exit_msc    = tmsc;
               exit_time   = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
               exit_price  = HistoryDealGetDouble(ticket, DEAL_PRICE);
               deal_reason = (long)HistoryDealGetInteger(ticket, DEAL_REASON);
              }
           }
        }
     }

   string why = (deal_reason == DEAL_REASON_SL)
                ? (g_giveback_applied ? "MFE_GIVEBACK_STOP_BROKER" : "INITIAL_STOP_BROKER")
                : (deal_reason == DEAL_REASON_TP) ? "TP_BROKER" : "EXTERNAL_CLOSE_BROKER";

   MqlTick q; SymbolInfoTick(_Symbol, q);
   double exitp  = exit_price > 0.0 ? exit_price : g_active_stop;
   double points = g_dir > 0 ? exitp - g_entry_price : g_entry_price - exitp;

   if(InpWriteTradeLog && f_trades != INVALID_HANDLE)
      FileWrite(f_trades, g_trade_id, g_run_id, D(g_dir),
                TimeToString(g_signal_time, TIME_DATE | TIME_SECONDS), TimeToString(g_entry_time, TIME_DATE | TIME_SECONDS),
                g_entry_price, g_initial_stop, g_active_stop, g_risk_points,
                TimeToString(exit_time > 0 ? exit_time : q.time, TIME_DATE | TIME_SECONDS), exitp, why,
                points, g_mfe_points, g_mae_points, B(g_giveback_applied));

   Alert("QUANTORA: posicion cerrada por el broker (fuera del EA) reason=", why, " pts=", DoubleToString(points, 1));
   Print("FIRST TRIANGLE EXTERNAL CLOSE DETECTED reason=", why, " points=", points);
   ClearMfeState();
   g_active = false;
   g_position_id = 0;
  }

bool TradeResultAccepted()
  {
   uint rc=g_trade.ResultRetcode();
   return rc==TRADE_RETCODE_DONE || rc==TRADE_RETCODE_DONE_PARTIAL || rc==TRADE_RETCODE_NO_CHANGES;
  }

bool OpenPosition(int dir,const IndicatorState &sig,const MqlTick &q)
  {
   ulong existing_ticket = 0;
   if(g_active || SelectOwnPosition(existing_ticket)) return false;

   string fail_reason="";
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      fail_reason="AUTOTRADING DESACTIVADO en terminal (boton AlgoTrading)";
   else if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      fail_reason="EA sin permiso: activa 'Permitir trading algoritmico' en propiedades del EA";
   else if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
      fail_reason="Cuenta en modo solo-lectura, no permite operar";
   else if(SymbolInfoInteger(_Symbol,SYMBOL_TRADE_MODE)!=SYMBOL_TRADE_MODE_FULL)
      fail_reason="Simbolo "+_Symbol+" no permite operar (mercado cerrado o close-only)";

   if(fail_reason!="")
     {
      Alert("QUANTORA ERROR: ",fail_reason);
      Print("QUANTORA START_TRADE_FAILED: ",fail_reason);
      return false;
     }

   double volume=CalculateEntryVolume();
   if(volume<=0.0)
     {
      Alert("QUANTORA GOLD ERROR: volumen calculado invalido. Operacion bloqueada.");
      Print("FIRST TRIANGLE GOLD ORDER BLOCKED: invalid calculated volume");
      return false;
     }
   double entry=dir>0?q.ask:q.bid;
   double stop=NormTick(dir>0?entry-InpStopPoints:entry+InpStopPoints);
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints((ulong)MathMax(1,MathRound(InpDeviationTicks*TickSize()/_Point)));
   g_trade.SetTypeFillingBySymbol(_Symbol);
   
   bool ok=dir>0 ? g_trade.Buy(volume,_Symbol,entry,stop,0.0,"Quantora FirstTriangle BUY")
                 : g_trade.Sell(volume,_Symbol,entry,stop,0.0,"Quantora FirstTriangle SELL");
   if(!ok || !TradeResultAccepted())
     {
      uint retcode=g_trade.ResultRetcode();
      string desc=g_trade.ResultRetcodeDescription();
      string msg="Orden rechazada: retcode="+IntegerToString(retcode)+" "+desc;
      Alert("QUANTORA ERROR: ",msg);
      Print("FIRST TRIANGLE ORDER REJECTED: ",msg);
      return false;
     }

   Sleep(100);
   ulong my_ticket=0;
   if(!SelectOwnPosition(my_ticket))
     {
      Alert("QUANTORA GOLD ERROR: orden aceptada pero posicion no confirmada.");
      Print("FIRST TRIANGLE GOLD OPEN NOT CONFIRMED retcode=",g_trade.ResultRetcode(),
            " ",g_trade.ResultRetcodeDescription());
      return false;
     }
   entry=PositionGetDouble(POSITION_PRICE_OPEN);
   stop=PositionGetDouble(POSITION_SL);
   g_position_id=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
   if(g_position_id==0) return false;
   g_active=true; g_trade_id++; g_dir=dir;
   g_signal_time=sig.bar_time; g_entry_time=q.time;
   g_entry_price=entry; g_risk_points=InpStopPoints;
   g_initial_stop=stop; g_active_stop=stop;
   g_mfe_points=0; g_mae_points=0; g_giveback_applied=false;
   SaveMfeState(); // persist the zero baseline immediately
   Alert("QUANTORA TRADE ABIERTO: ",D(dir)," ",_Symbol," entry=",DoubleToString(entry,_Digits)," SL=",DoubleToString(stop,_Digits));
   Print("FIRST TRIANGLE POSITION OPENED ",D(dir)," entry=",entry," sl=",stop);
   return true;
  }

void ClosePosition(string reason,const MqlTick &q,double forced_price=0.0)
  {
   if(!g_active) return;
   ulong close_ticket=0;
   if(!SelectOwnPosition(close_ticket,g_position_id))
     {
      // Already gone (broker closed it natively - SL/TP/manual) before we
      // got to it. Reconcile from history instead of leaving g_active stuck.
      Print("FIRST TRIANGLE CLOSE SKIPPED: position_id=",(long)g_position_id," already closed, syncing from history");
      SyncTradeState();
      return;
     }
   if(!g_trade.PositionClose(close_ticket))
     {
      Alert("QUANTORA ERROR: Cierre de posicion rechazado!");
      Print("FIRST TRIANGLE CLOSE REJECTED: ",g_trade.ResultRetcode()," ",g_trade.ResultRetcodeDescription());
      return;
     }
   double exitp=forced_price>0?forced_price:(g_dir>0?q.bid:q.ask);
   double points=g_dir>0?exitp-g_entry_price:g_entry_price-exitp;
   if(InpWriteTradeLog && f_trades!=INVALID_HANDLE)
      FileWrite(f_trades,g_trade_id,g_run_id,D(g_dir),
                TimeToString(g_signal_time,TIME_DATE|TIME_SECONDS),TimeToString(g_entry_time,TIME_DATE|TIME_SECONDS),
                g_entry_price,g_initial_stop,g_active_stop,g_risk_points,
                TimeToString(q.time,TIME_DATE|TIME_SECONDS),exitp,reason,points,g_mfe_points,g_mae_points,B(g_giveback_applied));
   Alert("QUANTORA TRADE CERRADO: ",D(g_dir)," reason=",reason," pts=",DoubleToString(points,1));
   Print("FIRST TRIANGLE POSITION CLOSED reason=",reason," points=",points);
   ClearMfeState();
   g_active=false;
   g_position_id=0;
  }

// --------------------- MFE persistence across EA/terminal restarts ---------
// MT5 global variables survive terminal/VPS restarts, EA recompiles and
// reattachments (they only expire after ~4 weeks unused). Keying them by
// symbol+magic+position_id means each open position gets its own slot, so
// RecoverState() can restore the REAL peak-favorable-excursion instead of
// silently resetting it to 0 - which used to freeze the stop-tightening
// logic until price re-earned the full activation distance from scratch.
string MfeVarName(){ return "QTX_"+_Symbol+"_"+IntegerToString((int)InpMagic)+"_"+IntegerToString((long)g_position_id)+"_MFE"; }
string MaeVarName(){ return "QTX_"+_Symbol+"_"+IntegerToString((int)InpMagic)+"_"+IntegerToString((long)g_position_id)+"_MAE"; }
string GbVarName() { return "QTX_"+_Symbol+"_"+IntegerToString((int)InpMagic)+"_"+IntegerToString((long)g_position_id)+"_GB";  }
void SaveMfeState()
  {
   if(g_position_id==0) return;
   GlobalVariableSet(MfeVarName(),g_mfe_points);
   GlobalVariableSet(MaeVarName(),g_mae_points);
   GlobalVariableSet(GbVarName(),g_giveback_applied?1.0:0.0);
  }
void LoadMfeState()
  {
   if(g_position_id!=0 && GlobalVariableCheck(MfeVarName()))
     {
      g_mfe_points=GlobalVariableGet(MfeVarName());
      g_mae_points=GlobalVariableCheck(MaeVarName())?GlobalVariableGet(MaeVarName()):0.0;
      g_giveback_applied=GlobalVariableCheck(GbVarName()) && GlobalVariableGet(GbVarName())>0.5;
      Print("FIRST TRIANGLE MFE STATE RESTORED: mfe=",g_mfe_points," mae=",g_mae_points," giveback_applied=",B(g_giveback_applied));
     }
   else
     {
      g_mfe_points=0; g_mae_points=0; g_giveback_applied=false;
      Print("FIRST TRIANGLE MFE STATE NOT FOUND (fresh position or first ever restart) - starting at 0");
     }
  }
void ClearMfeState()
  {
   if(g_position_id==0) return;
   GlobalVariableDel(MfeVarName());
   GlobalVariableDel(MaeVarName());
   GlobalVariableDel(GbVarName());
  }

bool TightenStopToPrice(double requested_stop,const MqlTick &q)
  {
   ulong ticket=0;
   if(!SelectOwnPosition(ticket,g_position_id))
     {
      Print("FIRST TRIANGLE GOLD SL SKIPPED: position not found id=",(long)g_position_id);
      return false;
     }

   double broker_sl=PositionGetDouble(POSITION_SL);
   double broker_tp=PositionGetDouble(POSITION_TP);
   double proposed=NormTick(requested_stop);

   // Never loosen the broker SL or a tighter SL placed manually.
   if(g_dir>0 && broker_sl>0.0) proposed=MathMax(proposed,broker_sl);
   if(g_dir<0 && broker_sl>0.0) proposed=MathMin(proposed,broker_sl);
   if(broker_sl>0.0 && MathAbs(proposed-broker_sl)<TickSize()/2.0)
     { g_active_stop=broker_sl; return true; }

   long stops=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL);
   long freeze=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_FREEZE_LEVEL);
   double min_dist=(double)MathMax(stops,freeze)*_Point;
   if((g_dir>0 && proposed>q.bid-min_dist) || (g_dir<0 && proposed<q.ask+min_dist))
     {
      Print("FIRST TRIANGLE GOLD SL BLOCKED BY DISTANCE proposed=",proposed,
            " min_dist=",min_dist," bid=",q.bid," ask=",q.ask);
      return false;
     }

   ResetLastError();
   bool sent=g_trade.PositionModify(ticket,proposed,broker_tp);
   if(!sent || !TradeResultAccepted())
     {
      Alert("QUANTORA GOLD ERROR: el broker rechazo mover el SL.");
      Print("FIRST TRIANGLE GOLD SL REJECTED retcode=",g_trade.ResultRetcode(),
            " ",g_trade.ResultRetcodeDescription()," proposed=",proposed,
            " broker_sl=",broker_sl," error=",GetLastError());
      return false;
     }

   if(!SelectOwnPosition(ticket,g_position_id)) return false;
   double confirmed=PositionGetDouble(POSITION_SL);
   bool valid=confirmed>0.0 && (g_dir>0 ? confirmed>=proposed-TickSize()/2.0
                                      : confirmed<=proposed+TickSize()/2.0);
   if(!valid)
     {
      Print("FIRST TRIANGLE GOLD SL NOT CONFIRMED proposed=",proposed," actual=",confirmed);
      if(confirmed>0.0) g_active_stop=confirmed;
      return false;
     }
   g_active_stop=confirmed;
   Print("FIRST TRIANGLE GOLD SL MOVED: SL=",DoubleToString(confirmed,_Digits),
         " MFE=",DoubleToString(g_mfe_points,2));
   return true;
  }

// GOLD/XAUUSD: activate at +60.00 price units and trail 25.00 behind
// the best favorable executable price reached since entry.
void UpdateTickPosition(const MqlTick &q)
  {
   if(!g_active) return;
   ulong ticket=0;
   if(!SelectOwnPosition(ticket,g_position_id)) { SyncTradeState(); return; }

   double broker_sl=PositionGetDouble(POSITION_SL);
   if(broker_sl>0.0) g_active_stop=broker_sl;

   double mark=g_dir>0?q.bid:q.ask;
   double pts=g_dir>0?mark-g_entry_price:g_entry_price-mark;
   double previous_mfe=g_mfe_points;
   g_mfe_points=MathMax(g_mfe_points,pts);
   g_mae_points=MathMax(g_mae_points,-pts);

   if(g_mfe_points>=InpTrailActivationPoints)
     {
      double best=g_dir>0?g_entry_price+g_mfe_points:g_entry_price-g_mfe_points;
      double target=NormTick(g_dir>0?best-InpTrailDistancePoints:best+InpTrailDistancePoints);
      bool crossed=g_dir>0?q.bid<=target:q.ask>=target;
      if(crossed)
        {
         g_giveback_applied=true;
         SaveMfeState();
         ClosePosition("GOLD_TRAILING_TARGET_CROSSED",q);
         return;
        }
      if(TightenStopToPrice(target,q)) g_giveback_applied=true;
     }

   if(g_mfe_points!=previous_mfe || g_giveback_applied) SaveMfeState();
   if(g_active_stop>0.0)
     {
      bool hit=g_dir>0?q.bid<=g_active_stop:q.ask>=g_active_stop;
      if(hit) ClosePosition(g_giveback_applied?"GOLD_TRAILING_STOP":"INITIAL_STOP",q,g_active_stop);
     }
  }
void ProcessFirstTriangle(const IndicatorState &s,const IndicatorState &p,const MqlTick &q, bool execute)
  {
   bool buy_triangle=InpAllowLong && s.full_long && !p.full_long;
   bool sell_triangle=InpAllowShort && s.full_short && !p.full_short;
   int dir=buy_triangle?1:sell_triangle?-1:0;
   if(dir==0) return;

   if(dir==g_cycle_side)
     {
      Print("SIGNAL_IGNORED_SAME_SIDE dir=",D(dir)," bar=",TimeToString(s.bar_time,TIME_DATE|TIME_MINUTES),
            " waiting_opposite=",dir>0?"SELL":"BUY");
      return;
     }

   DrawAcceptedArrow(s,dir);
   Print("FIRST_TRIANGLE_ACCEPTED dir=",D(dir)," bar=",TimeToString(s.bar_time,TIME_DATE|TIME_MINUTES),
         " cloud=",s.cloud_bull?"BULL":"BEAR"," st=",s.st_dir,
         " qqe_blue=",B(s.qqe_blue)," qqe_red=",B(s.qqe_red)," active=",B(g_active));

   if(execute)
     {
      if(g_active && g_dir!=dir)
        {
         if(InpEnableOppositeFallback)
           {
            ClosePosition("OPPOSITE_TRIANGLE_FALLBACK",q);
            if(!g_active)
              {
               g_cycle_side=dir;
               // Reverse immediately: this signal both closed the old side
               // and is the first opposite-side signal, so open it now
               // instead of waiting for a future transition that may never
               // re-fire (full_short/full_long only flips on edge).
               if(OpenPosition(dir,s,q))
                  g_cycle_side=dir;
              }
           }
         return; 
        }

      if(!g_active)
        {
         if(OpenPosition(dir,s,q))
            g_cycle_side=dir; 
        }
     }
   else
     {
      g_cycle_side=dir; // just sync cycle side on startup
     }
  }

//---------------------------- Lifecycle ------------------------------
void RecoverState()
  {
   g_active=false;
   for(int i=PositionsTotal()-1; i>=0; i--)
     {
      string sym=PositionGetSymbol(i);
      if(sym==_Symbol)
        {
         long magic=PositionGetInteger(POSITION_MAGIC);
         if(magic==InpMagic)
           {
            g_active=true;
            g_position_id=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
            long type=PositionGetInteger(POSITION_TYPE);
            g_dir = type==POSITION_TYPE_BUY ? 1 : -1;
            g_entry_price = PositionGetDouble(POSITION_PRICE_OPEN);
            g_active_stop = PositionGetDouble(POSITION_SL);
            g_initial_stop = g_active_stop;
            g_entry_time = (datetime)PositionGetInteger(POSITION_TIME);
            LoadMfeState(); // restores real MFE/MAE instead of zeroing them
            Print("FIRST TRIANGLE RECOVERED POSITION: ",D(g_dir)," Entry=",g_entry_price," SL=",g_active_stop);
            break;
           }
        }
     }
  }

int OnInit()
  {
   if(InpTF!=PERIOD_M15 || MathAbs(InpStopPoints-55.0)>1e-9 ||
      MathAbs(InpTrailActivationPoints-60.0)>1e-9 || MathAbs(InpTrailDistancePoints-25.0)>1e-9)
     { Print("QUANTORA ABORT GOLD CONFIG: requires M15 SL55 ACT60 DIST25"); return INIT_PARAMETERS_INCORRECT; }
   if(InpBaseVolume<=0.0 || InpFixedVolume<=0.0 || InpBalanceStep<=0.0 || InpMaximumVolume<0.0)
     { Print("QUANTORA GOLD ABORT: invalid dynamic volume inputs"); return INIT_PARAMETERS_INCORRECT; }
   if(CalculateEntryVolume()<=0.0)
     { Print("QUANTORA GOLD ABORT: calculated volume invalid for broker specification"); return INIT_PARAMETERS_INCORRECT; }
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetAsyncMode(false);
   g_trade.SetTypeFillingBySymbol(_Symbol);
   g_run_id=InpRunLabel+"_"+_Symbol+"_"+IntegerToString((int)TimeLocal());
   StringReplace(g_run_id,".","_");StringReplace(g_run_id," ","_");
   if(!CreateTradeLog()){ Print("Quantora: cannot create trade log CSV in Common/Files"); return INIT_FAILED; }
   
   RecoverState(); // Attach to our own open position if it exists, ignore other EAs
   RebuildAlternatingSignalHistory(); // was defined but never called - g_cycle_side
                                       // stayed 0 on every restart, breaking the
                                       // strict-alternation rule after the current
                                       // position eventually closes

   Print("Quantora First Triangle MFE-Giveback EA run: ",g_run_id);
   return INIT_SUCCEEDED;
  }


void OnTick()
  {
   MqlTick q; if(!SymbolInfoTick(_Symbol,q)) return;
   g_ticks++;
   SyncTradeState();
   UpdateTickPosition(q);
   datetime bar=iTime(_Symbol,InpTF,0);
   if(bar==0||bar==g_last_bar) return;
   g_last_bar=bar; g_bars_seen++;
   IndicatorState s,p;
   if(!CalculateClosedState(s,p)) return;
   g_cur=s; g_prev=p;
   ProcessFirstTriangle(s,p,q,true);
   if(InpShowComment)
      Comment("QUANTORA MT5 | www.quantoramt5.com\nFirst Triangle GOLD M15 | EA automatico\n",TimeToString(s.bar_time),
              "\nCloud: ",s.cloud_bull?"BULL":"BEAR"," ST: ",s.st_dir," QQE B/R: ",B(s.qqe_blue),"/",B(s.qqe_red),
              "\nPosition: ",g_active?D(g_dir):"FLAT",
              g_active?(" MFE="+DoubleToString(g_mfe_points,1)+" stop="+DoubleToString(g_active_stop,_Digits)):"");
  }

void OnDeinit(const int reason)
  {
   if(InpWriteTradeLog && f_trades!=INVALID_HANDLE) { FileFlush(f_trades); FileClose(f_trades); }
   Comment("");
   Print("Quantora First Triangle MFE-Giveback EA finished. Ticks=",g_ticks);
  }
//+------------------------------------------------------------------+
