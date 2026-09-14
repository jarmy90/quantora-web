//+------------------------------------------------------------------+
//| StochExtreme USTEC v3.18 - REAL + auto rama ultima flecha                  |
//| Trading logic preserved from Strict Cycle v3.10                  |
//| Stochastic adaptativo 20/80 arm, 25/75 cross, 60s confirm       |
//| MFE-Giveback exit (primary) + opposite signal fallback           |
//| Robust execution: pre-checks, Alert(), retry 30s, IOC fill      |
//+------------------------------------------------------------------+
#property copyright "Quantora MT5 | www.quantoramt5.com"
#property link      "https://www.quantoramt5.com"
#property version   "3.18"
#property strict

#include <Trade/Trade.mqh>
CTrade g_trade;

//===================================================================
//                          ENUMS
//===================================================================
enum ENUM_Q_CALC_MODE
  {
   Q_LIVE_INTRABAR = 0,          // Recalculate K/D on every tick
   Q_M30_CLOSED    = 1           // Research: closed M30 only
  };

enum ENUM_Q_EXECUTION_MODE
  {
   Q_REAL_ORDERS   = 0,          // Place real broker orders
   Q_VIRTUAL_ONLY  = 1           // Internal simulation, no orders
  };

enum ENUM_Q_ENTRY_MODEL
  {
   Q_PINE_INTRABAR_ORIGIN = 0,   // K touches 20/80 intrabar
   Q_CLOSED_ORIGIN_MARGIN = 1    // K must CLOSE <=20/>=80
  };

enum ENUM_Q_SESSION_FILTER
  {
   Q_SESSION_ALL                  = 0,
   Q_EXCLUDE_OVERNIGHT            = 1,
   Q_EXCLUDE_EUROPE               = 2,
   Q_EXCLUDE_US_PREMARKET         = 3,
   Q_EXCLUDE_US_OPEN              = 4,
   Q_EXCLUDE_US_MIDDAY            = 5,
   Q_EXCLUDE_US_AFTERNOON         = 6,
   Q_EXCLUDE_US_POSTMARKET        = 7,
   Q_EXCLUDE_MIDDAY_AND_OVERNIGHT = 8  // Block 11:30-14:00 ET and 18:00-03:00 ET
  };

//===================================================================
//                          INPUTS
//===================================================================
input group "Strategy"
input ENUM_Q_CALC_MODE      InpCalculationMode  = Q_LIVE_INTRABAR;
input ENUM_Q_ENTRY_MODEL    InpEntryModel       = Q_PINE_INTRABAR_ORIGIN;
input ENUM_TIMEFRAMES       InpWorkTF           = PERIOD_M30;
input ENUM_TIMEFRAMES       InpATRTF            = PERIOD_M3;
input int                   InpATRLen           = 14;
input int                   InpBaseLen          = 2200;
input int                   InpArmLockReplayBars= 700;     // M30 bars replayed on start to rebuild adaptive_tf/K/D/armed/locked (matches indicator's InpHistoryBars)
input int                   InpConfirmSec       = 60;
input double                InpStopPriceDistance= 100.0;    // SL in index points (price distance)
input group "Dynamic balance-based volume"
input bool                  InpUseDynamicVolume = true;     // Calculate before every new entry
input double                InpBaseVolume       = 0.30;     // Volume per complete 1000 balance block
input double                InpBalanceStep      = 1000.0;   // Account-currency units per block
input double                InpMaximumVolume    = 0.0;      // 0 = no EA cap, broker max still applies
input double                InpFixedVolume      = 0.30;     // Used only if dynamic mode is disabled
input int                   InpWarmupWorkBars   = 20;

input group "MFE Giveback (PRIMARY exit)"
input double                InpMFE_Level1       = 200.0;    // MFE threshold level 1 (price pts)
input double                InpGiveback1        = 150.0;    // Max giveback from peak at level 1
input double                InpMFE_Level2       = 400.0;    // MFE threshold level 2
input double                InpGiveback2        = 200.0;    // Max giveback from peak at level 2
input double                InpMFE_Level3       = 700.0;    // MFE threshold level 3
input double                InpGiveback3        = 250.0;    // Max giveback from peak at level 3
input bool                  InpUseTargetFallback= true;     // Keep opposite K80/K20 as fallback exit
input int                   InpEarlyTargetSec    = 10;       // Also close during final N seconds of M30 when live K already reaches opposite extreme

input group "Session filter"
input ENUM_Q_SESSION_FILTER InpSessionFilter    = Q_EXCLUDE_MIDDAY_AND_OVERNIGHT;
input int                   InpServerUtcOffsetHours = 3;
input bool                  InpUseNewYorkDST    = true;

input group "Execution"
input ENUM_Q_EXECUTION_MODE InpExecutionMode    = Q_REAL_ORDERS;
input ulong                 InpMagic            = 257510;
input int                   InpDeviationTicks   = 4;
input bool                  InpOnePositionOnly  = true;

input group "Export"
input string                InpRunLabel         = "STOCHEXTREME_USTEC";
input bool                  InpWriteEquityMinute= true;
input bool                  InpWriteAllStateEvents = true;
input bool                  InpWriteTickAudit   = false;
input bool                  InpShowLiveComment  = false;
input bool                  InpShowArmedLegend = true; // Always show EA armed state on main chart

//===================================================================
//                       CONSTANTS
//===================================================================
#define LVL20  20.0
#define LVL25  25.0
#define LVL75  75.0
#define LVL80  80.0
#define MAX_RETRY_SEC  30     // Max seconds to retry trade execution

//===================================================================
//                       TRADE STATE
//===================================================================
struct TradeState
  {
   bool     active;
   long     trade_id;
   ulong    position_id;
   int      dir;                 // +1 BUY, -1 SELL
   datetime signal_time;
   datetime confirm_time;
   datetime entry_time;
   long     entry_time_msc;
   double   entry_bid;
   double   entry_ask;
   double   entry_price;
   double   volume;
   double   stop_price;          // Current active SL (may be modified by giveback)
   double   initial_stop;        // Original SL at entry
   double   entry_k;
   double   entry_d;
   int      entry_adaptive_tf;
   int      entry_k_len;
   double   peak_price;          // Best price: max bid (buy) or min ask (sell)
   double   mae_points;
   double   mfe_points;
   bool     giveback_active;     // True once any MFE level triggered
   int      giveback_level;      // Highest level reached (0,1,2,3)
   double   target_closed_k;
   double   target_closed_d;
   bool     close_pending;
   string   close_reason;
   string   close_structural;
   datetime close_request_time;
  };

//===================================================================
//                      GLOBAL STATE
//===================================================================
// Signal machine
bool     g_buy_armed = false, g_sell_armed = false;
bool     g_buy_locked = false, g_sell_locked = false;
int      g_last_history_signal = 0;
int      g_pending_dir = 0;
datetime g_pending_start = 0;
datetime g_pending_signal_time = 0;
bool     g_pending_confirmed = false;
int      g_pending_retries = 0;
datetime g_pending_first_retry = 0;

// Stochastic engine
int      g_adaptive_tf = 30;
int      g_k_len = 5;
double   g_k = 50.0, g_d = 50.0, g_prev_k = 50.0, g_prev_d = 50.0;
double   g_raw_hist[4], g_k_hist[4];
bool     g_series_ready = false;
int      g_work_bars_seen = 0;
bool     g_pending_shift = false;
datetime g_last_work_bar = 0;
bool g_closed_snapshot_pending=false, g_closed_snapshot_ready=false;
datetime g_closed_bar_close_time=0;
double g_closed_k=50.0, g_closed_d=50.0;
// Persistent target latch: once the opposite extreme is seen in the final
// seconds or confirmed at M30 close, the exit remains mandatory and is
// retried on every tick until the broker accepts it or the position is gone.
bool     g_target_exit_latched = false;
string   g_target_exit_reason = "";
double   g_target_exit_k = 0.0;
double   g_target_exit_d = 0.0;
datetime g_target_exit_time = 0;

// Two independent trade contexts. g_ts is the primary context used by the
// original management engine; g_ts2 is swapped into that engine tick by tick.
TradeState g_ts;
TradeState g_ts2;
bool     g_target2_exit_latched = false;
string   g_target2_exit_reason = "";
double   g_target2_exit_k = 0.0;
double   g_target2_exit_d = 0.0;
datetime g_target2_exit_time = 0;

void SwapTradeContexts()
  {
   TradeState tmp=g_ts; g_ts=g_ts2; g_ts2=tmp;
   bool bl=g_target_exit_latched; g_target_exit_latched=g_target2_exit_latched; g_target2_exit_latched=bl;
   string sr=g_target_exit_reason; g_target_exit_reason=g_target2_exit_reason; g_target2_exit_reason=sr;
   double dk=g_target_exit_k; g_target_exit_k=g_target2_exit_k; g_target2_exit_k=dk;
   double dd=g_target_exit_d; g_target_exit_d=g_target2_exit_d; g_target2_exit_d=dd;
   datetime dt=g_target_exit_time; g_target_exit_time=g_target2_exit_time; g_target2_exit_time=dt;
  }

bool SideAlreadyActive(int dir)
  { return (g_ts.active && g_ts.dir==dir) || (g_ts2.active && g_ts2.dir==dir); }
bool AnyTradeActive()
  { return g_ts.active || g_ts2.active; }
bool OppositeTradeActive(int dir)
  { return (g_ts.active && g_ts.dir==-dir) || (g_ts2.active && g_ts2.dir==-dir); }


// Run statistics
datetime g_last_equity_minute = 0;
long     g_next_trade_id = 1;
long     g_next_event_id = 1;
string   g_run_id = "";
long     g_ticks_processed = 0;
datetime g_first_tick = 0, g_last_tick = 0, g_first_usable = 0;
double   g_initial_balance = 0.0;
double   g_peak_equity = 0.0;
int      g_closed_trades = 0, g_struct_wins = 0, g_struct_losses = 0;
double   g_net_profit = 0.0, g_gross_profit = 0.0, g_gross_loss = 0.0;
double   g_max_dd_abs = 0.0, g_max_dd_pct = 0.0;

// Indicator handles and file handles
int      g_atr_handle = INVALID_HANDLE;
int      g_f_spec = INVALID_HANDLE, g_f_config = INVALID_HANDLE;
int      g_f_events = INVALID_HANDLE, g_f_trades = INVALID_HANDLE;
int      g_f_equity = INVALID_HANDLE, g_f_manifest = INVALID_HANDLE;
int      g_f_coverage = INVALID_HANDLE, g_f_ticks = INVALID_HANDLE;

// ATR and work bar caches (performance only, no strategy impact)
datetime g_cached_atr_bar = 0;
double   g_closed_atr_sum = 0.0;
bool     g_atr_cache_ready = false;
double   g_closed_high[10], g_closed_low[10];
double   g_live_work_high = 0.0, g_live_work_low = 0.0, g_live_work_close = 0.0;
bool     g_work_cache_ready = false;

//===================================================================
//                    UTILITY FUNCTIONS
//===================================================================
string BoolText(bool v)  { return v ? "true" : "false"; }
string DirText(int d)    { return d > 0 ? "BUY" : d < 0 ? "SELL" : "NONE"; }
string CalcModeText()    { return InpCalculationMode == Q_LIVE_INTRABAR ? "LIVE_INTRABAR" : "M30_CLOSED"; }
string ExecModeText()    { return InpExecutionMode == Q_REAL_ORDERS ? "REAL_ORDERS" : "VIRTUAL_ONLY"; }

double TickSize()
  {
   double v = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   return v > 0.0 ? v : SymbolInfoDouble(_Symbol, SYMBOL_POINT);
  }

double NormalizeToTick(double price)
  {
   double t = TickSize();
   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(t <= 0.0) return NormalizeDouble(price, digits);
   return NormalizeDouble(MathRound(price / t) * t, digits);
  }

int VolumeDigits(double step)
  {
   int d = 0;
   while(d < 8 && MathAbs(step - MathRound(step)) > 1e-10)
     { step *= 10.0; d++; }
   return d;
  }

bool IsVolumeValid(double volume, string &why)
  {
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(volume < vmin - 1e-9 || volume > vmax + 1e-9)
     { why = StringFormat("Volume %.4f outside broker range %.4f..%.4f", volume, vmin, vmax); return false; }
   if(step <= 0.0)
     { why = "Invalid broker volume step"; return false; }
   double n = (volume - vmin) / step;
   if(MathAbs(n - MathRound(n)) > 1e-8)
     { why = StringFormat("Volume %.4f not aligned to min %.4f step %.4f", volume, vmin, step); return false; }
   why = "OK";
   return true;
  }
double NormalizeVolumeDown(double requested)
  {
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(vmin <= 0.0 || vmax <= 0.0 || step <= 0.0) return 0.0;
   double capped = MathMin(requested, vmax);
   if(InpMaximumVolume > 0.0) capped = MathMin(capped, InpMaximumVolume);
   if(capped < vmin - 1e-9) return 0.0;
   // Always round down to the broker step, never upward into extra risk.
   double steps = MathFloor((capped - vmin + 1e-12) / step);
   double normalized = vmin + steps * step;
   return NormalizeDouble(MathMax(vmin, MathMin(normalized, vmax)), VolumeDigits(step));
  }
double CalculateEntryVolume(bool write_log=true)
  {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   int blocks = 1;
   double requested = InpFixedVolume;
   if(InpUseDynamicVolume)
     {
      blocks = (int)MathFloor(balance / InpBalanceStep + 1e-12);
      if(blocks < 1) blocks = 1;
      requested = InpBaseVolume * (double)blocks;
     }
   double normalized = NormalizeVolumeDown(requested);
   if(write_log)
      Print("STOCHEXTREME DYNAMIC VOLUME: asset="+_Symbol,
            " balance=", DoubleToString(balance,2),
            " currency=", AccountInfoString(ACCOUNT_CURRENCY),
            " blocks=", blocks,
            " requested=", DoubleToString(requested,4),
            " normalized=", DoubleToString(normalized,VolumeDigits(SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP))));
   return normalized;
  }

//===================================================================
//                     ARMED STATE LEGEND
//===================================================================
string ArmedLegendName()
  {
   return "QSE_ARMED_" + IntegerToString((long)InpMagic);
  }
void DrawArmedLegend()
  {
   string name=ArmedLegendName();
   if(!InpShowArmedLegend)
     { ObjectDelete(0,name); return; }
   if(ObjectFind(0,name)<0)
     {
      if(!ObjectCreate(0,name,OBJ_LABEL,0,0,0)) return;
      ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_RIGHT_UPPER);
      ObjectSetInteger(0,name,OBJPROP_ANCHOR,ANCHOR_RIGHT_UPPER);
      ObjectSetInteger(0,name,OBJPROP_XDISTANCE,12);
      ObjectSetInteger(0,name,OBJPROP_YDISTANCE,28);
      ObjectSetInteger(0,name,OBJPROP_FONTSIZE,11);
      ObjectSetString(0,name,OBJPROP_FONT,"Arial Bold");
      ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
      ObjectSetInteger(0,name,OBJPROP_HIDDEN,true);
     }
   string armed=g_buy_armed ? "BUY" : (g_sell_armed ? "SELL" : "NONE");
   string last=DirText(g_last_history_signal);
   string text="QUANTORA MT5  |  www.quantoramt5.com  |  STOCHEXTREME USTEC\n"+
               "EA AUTOMATICO  |  ESTADO: "+armed+
               "  |  ULTIMA SENAL: "+last+
               "  |  COMPRA "+(g_buy_armed?"LISTA":"NO")+
               "  VENTA "+(g_sell_armed?"LISTA":"NO");
   color c=g_buy_armed ? clrLime : (g_sell_armed ? clrOrangeRed : clrGold);
   ObjectSetString(0,name,OBJPROP_TEXT,text);
   ObjectSetInteger(0,name,OBJPROP_COLOR,c);
  }

//===================================================================
//                     CSV FILE FUNCTIONS
//===================================================================
int OpenCsv(string suffix)
  {
   string name = "Quantora_" + g_run_id + "_" + suffix + ".csv";
   return FileOpen(name, FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
  }

void FlushAll()
  {
   if(g_f_events != INVALID_HANDLE)  FileFlush(g_f_events);
   if(g_f_trades != INVALID_HANDLE)  FileFlush(g_f_trades);
   if(g_f_equity != INVALID_HANDLE)  FileFlush(g_f_equity);
   if(g_f_ticks != INVALID_HANDLE)   FileFlush(g_f_ticks);
  }

void Event(string type, int dir, string detail)
  {
   MqlTick q;
   SymbolInfoTick(_Symbol, q);

   // Mirrors every event to the visible Expertos/Diario log (not just the
   // CSV), so the exact K/D/armed/locked state at the moment of any
   // decision - or non-decision - can be checked directly from the
   // terminal on any device, without needing filesystem access to
   // Common/Files. This was the main friction point diagnosing prior
   // issues (2026.08.13-14): the CSV has the truth, but is hard to reach
   // from mobile.
   Print("STOCHEXTREME EVENT [", type, "] dir=", DirText(dir),
         " bid=", DoubleToString(q.bid, _Digits), " ask=", DoubleToString(q.ask, _Digits),
         " k=", DoubleToString(g_k, 3), " d=", DoubleToString(g_d, 3),
         " adaptive_tf=", g_adaptive_tf, " k_len=", g_k_len,
         " buy_armed=", BoolText(g_buy_armed), " sell_armed=", BoolText(g_sell_armed),
         " buy_locked=", BoolText(g_buy_locked), " sell_locked=", BoolText(g_sell_locked),
         " | ", detail);

   if(g_f_events == INVALID_HANDLE) return;
   FileWrite(g_f_events,
             g_next_event_id++, g_run_id,
             TimeToString(q.time, TIME_DATE | TIME_SECONDS), q.time_msc,
             type, DirText(dir),
             DoubleToString(q.bid, _Digits), DoubleToString(q.ask, _Digits),
             DoubleToString(g_k, 8), DoubleToString(g_d, 8),
             g_adaptive_tf, g_k_len,
             BoolText(g_buy_armed), BoolText(g_sell_armed),
             BoolText(g_buy_locked), BoolText(g_sell_locked),
             g_pending_dir, g_pending_start,
             g_ts.active ? g_ts.dir : 0,
             g_ts.active ? g_ts.trade_id : 0,
             detail);
  }

bool CreateFiles()
  {
   g_f_spec     = OpenCsv("symbol_specifications");
   g_f_config   = OpenCsv("strategy_config");
   g_f_events   = OpenCsv("events");
   g_f_trades   = OpenCsv("trades");
   g_f_equity   = OpenCsv("equity");
   g_f_manifest = OpenCsv("manifest");
   g_f_coverage = OpenCsv("coverage");
   if(InpWriteTickAudit) g_f_ticks = OpenCsv("ticks");

   if(g_f_spec == INVALID_HANDLE || g_f_config == INVALID_HANDLE ||
      g_f_events == INVALID_HANDLE || g_f_trades == INVALID_HANDLE ||
      g_f_equity == INVALID_HANDLE || g_f_manifest == INVALID_HANDLE ||
      g_f_coverage == INVALID_HANDLE)
      return false;

   // Symbol specifications header + data
   FileWrite(g_f_spec, "run_id","broker","server","account_currency","symbol","description",
             "digits","point","tick_size","tick_value","tick_value_profit","tick_value_loss",
             "contract_size","volume_min","volume_max","volume_step","stops_level","freeze_level",
             "calc_mode","profit_currency","margin_currency","generated_at");
   FileWrite(g_f_spec, g_run_id,
             AccountInfoString(ACCOUNT_COMPANY), AccountInfoString(ACCOUNT_SERVER),
             AccountInfoString(ACCOUNT_CURRENCY), _Symbol,
             SymbolInfoString(_Symbol, SYMBOL_DESCRIPTION),
             (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS),
             SymbolInfoDouble(_Symbol, SYMBOL_POINT), TickSize(),
             SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE),
             SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT),
             SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE_LOSS),
             SymbolInfoDouble(_Symbol, SYMBOL_TRADE_CONTRACT_SIZE),
             SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN),
             SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX),
             SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP),
             (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL),
             (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL),
             (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_CALC_MODE),
             SymbolInfoString(_Symbol, SYMBOL_CURRENCY_PROFIT),
             SymbolInfoString(_Symbol, SYMBOL_CURRENCY_MARGIN),
             TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS));

   // Strategy config
   FileWrite(g_f_config, "run_id","strategy","version","calculation_mode","entry_model",
             "execution_mode","work_tf","atr_tf","atr_len","baseline_len","confirm_sec",
             "stop_price_distance","requested_volume","magic","session_filter",
             "mfe_level1","giveback1","mfe_level2","giveback2","mfe_level3","giveback3",
             "use_target_fallback");
   FileWrite(g_f_config, g_run_id, "STOCHEXTREME_IC", "3.18",
             CalcModeText(), EnumToString(InpEntryModel), ExecModeText(),
             EnumToString(InpWorkTF), EnumToString(InpATRTF),
             InpATRLen, InpBaseLen, InpConfirmSec, InpStopPriceDistance, CalculateEntryVolume(false), InpMagic,
             EnumToString(InpSessionFilter),
             InpMFE_Level1, InpGiveback1, InpMFE_Level2, InpGiveback2,
             InpMFE_Level3, InpGiveback3, BoolText(InpUseTargetFallback));

   // Events header
   FileWrite(g_f_events, "event_id","run_id","time","time_msc","event_type","direction",
             "bid","ask","k","d","adaptive_tf","k_len","buy_armed","sell_armed",
             "buy_locked","sell_locked","pending_dir","pending_start",
             "active_dir","trade_id","detail");

   // Trades header
   FileWrite(g_f_trades, "trade_id","position_id","run_id","symbol","direction",
             "signal_time","confirmation_time","entry_time","entry_time_msc",
             "entry_bid","entry_ask","entry_price","volume","initial_stop","final_stop",
             "exit_time","exit_time_msc","exit_bid","exit_ask","exit_price",
             "exit_reason","structural_outcome","economic_outcome",
             "deal_profit","commission","swap","net_pnl",
             "calculated_price_pnl","pnl_discrepancy",
             "price_move","ticks_move","r_multiple","duration_seconds",
             "entry_k","entry_d","entry_adaptive_tf","entry_k_len",
             "target_closed_k","target_closed_d","live_exit_k","live_exit_d",
             "mae_points","mfe_points","giveback_level",
             "spread_entry","spread_exit","stop_slippage_points","deal_reason");

   // Equity header
   FileWrite(g_f_equity, "run_id","time","time_msc","balance","equity","floating_pnl",
             "realized_pnl","drawdown_absolute","drawdown_percent",
             "active_position","trade_id");

   // Manifest header
   FileWrite(g_f_manifest, "run_id","status","strategy_version","symbol","calculation_mode",
             "execution_mode","start_time","end_time","ticks_processed","closed_trades",
             "structural_wins","structural_losses","net_profit","profit_factor",
             "max_drawdown_absolute","max_drawdown_percent","warnings");

   // Coverage header
   FileWrite(g_f_coverage, "run_id","symbol","first_tick","last_tick",
             "first_usable_signal_time","ticks_processed","work_bars_seen","warmup_complete");

   // Tick audit header
   if(g_f_ticks != INVALID_HANDLE)
      FileWrite(g_f_ticks, "run_id","time","time_msc","bid","ask","last","volume",
                "k","d","adaptive_tf","k_len","active_trade_id");

   return true;
  }

void CloseFiles()
  {
   int hs[8] = {g_f_spec, g_f_config, g_f_events, g_f_trades,
                g_f_equity, g_f_manifest, g_f_coverage, g_f_ticks};
   for(int i = 0; i < 8; i++)
      if(hs[i] != INVALID_HANDLE) FileClose(hs[i]);
  }

//===================================================================
//                    ATR ENGINE (ADAPTIVE)
//===================================================================
bool RefreshAtrCache()
  {
   double closed[];
   ArraySetAsSeries(closed, true);
   int need = InpBaseLen - 1;
   if(need < 1) return false;
   int copied = CopyBuffer(g_atr_handle, 0, 1, need, closed);
   if(copied < need) return false;
   double sum = 0.0;
   for(int i = 0; i < need; i++)
     {
      if(closed[i] == EMPTY_VALUE || !MathIsValidNumber(closed[i])) return false;
      sum += closed[i];
     }
   g_closed_atr_sum = sum;
   g_cached_atr_bar = iTime(_Symbol, InpATRTF, 0);
   g_atr_cache_ready = true;
   return true;
  }

bool GetAtrNowAndBase(double &atr_now, double &atr_base)
  {
   atr_now = 0.0;
   atr_base = 0.0;
   int shift = InpCalculationMode == Q_M30_CLOSED ? 1 : 0;
   datetime atr_bar = iTime(_Symbol, InpATRTF, 0);
   if(!g_atr_cache_ready || atr_bar != g_cached_atr_bar)
      if(!RefreshAtrCache()) return false;
   double now[1];
   if(CopyBuffer(g_atr_handle, 0, shift, 1, now) != 1) return false;
   atr_now = now[0];
   if(shift == 0)
      atr_base = (g_closed_atr_sum + atr_now) / InpBaseLen;
   else
     {
      double buf[];
      ArraySetAsSeries(buf, true);
      if(CopyBuffer(g_atr_handle, 0, 1, InpBaseLen, buf) < InpBaseLen) return false;
      double sum = 0.0;
      for(int i = 0; i < InpBaseLen; i++) sum += buf[i];
      atr_base = sum / InpBaseLen;
     }
   return atr_base > 0.0;
  }

//===================================================================
//                  STOCHASTIC ENGINE
//===================================================================
double RawStochSlow(int length, int shift)
  {
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, InpWorkTF, shift, length, rates) < length) return EMPTY_VALUE;
   double hi = -DBL_MAX, lo = DBL_MAX;
   for(int i = 0; i < length; i++)
     {
      hi = MathMax(hi, rates[i].high);
      lo = MathMin(lo, rates[i].low);
     }
   double c = rates[0].close;
   if(hi <= lo) return 50.0;
   return 100.0 * (c - lo) / (hi - lo);
  }

bool RefreshWorkCache(const MqlTick &q)
  {
   double h[], l[];
   ArraySetAsSeries(h, true);
   ArraySetAsSeries(l, true);
   if(CopyHigh(_Symbol, InpWorkTF, 1, 9, h) < 9) return false;
   if(CopyLow(_Symbol, InpWorkTF, 1, 9, l) < 9) return false;
   for(int i = 0; i < 9; i++)
     {
      g_closed_high[i] = h[i];
      g_closed_low[i] = l[i];
     }
   g_live_work_high = q.bid;
   g_live_work_low = q.bid;
   g_live_work_close = q.bid;
   g_work_cache_ready = true;
   return true;
  }

void UpdateLiveWorkCache(const MqlTick &q, bool new_work_bar)
  {
   if(new_work_bar || !g_work_cache_ready)
     { RefreshWorkCache(q); return; }
   g_live_work_high  = MathMax(g_live_work_high, q.bid);
   g_live_work_low   = MathMin(g_live_work_low, q.bid);
   g_live_work_close = q.bid;
  }

double RawStochFast(int length, int shift)
  {
   if(shift != 0 || !g_work_cache_ready) return RawStochSlow(length, shift);
   double hi = g_live_work_high, lo = g_live_work_low;
   int closed_needed = length - 1;
   for(int i = 0; i < closed_needed; i++)
     {
      hi = MathMax(hi, g_closed_high[i]);
      lo = MathMin(lo, g_closed_low[i]);
     }
   if(hi <= lo) return 50.0;
   return 100.0 * (g_live_work_close - lo) / (hi - lo);
  }

// Faithful port of the indicator's BuildHistoryStoch(): walks real M30/M3
// history forward (oldest -> newest) recomputing the TRUE adaptive_tf/kLen
// trajectory, instead of always starting g_adaptive_tf=30/g_k_len=5 and
// having to "catch up" live at +-2 per M30 bar (up to 4 hours after every
// restart). It also replays the arm/cross/lock state machine along the way,
// so this single function replaces both the old SeedSeries() and
// ReplayArmLockState() - which used a crude fixed-length-5 approximation
// and left g_adaptive_tf/g_k_len untouched, the real source of the
// USTEC 2026.08.12 missed-target discrepancy against the indicator.
bool BuildHistoryState(int lookback_bars)
  {
   int wantM30 = lookback_bars;
   int pad = 15;
   int need = wantM30 + pad;

   MqlRates rM30[];
   ArraySetAsSeries(rM30, true);
   int gotM30 = CopyRates(_Symbol, InpWorkTF, 1, need, rM30);
   if(gotM30 < pad + 10) return false;
   int n = gotM30;

   double h30[], l30[], c30[];
   datetime t30[];
   ArrayResize(h30, n); ArrayResize(l30, n); ArrayResize(c30, n); ArrayResize(t30, n);
   for(int i = 0; i < n; i++)
     {
      int z = n - 1 - i;
      h30[i] = rM30[z].high; l30[i] = rM30[z].low; c30[i] = rM30[z].close; t30[i] = rM30[z].time;
     }

   int m3_count = InpBaseLen + n * 12 + 100;
   double atrBuf[];
   ArraySetAsSeries(atrBuf, false);
   int gotAtr = CopyBuffer(g_atr_handle, 0, 0, m3_count, atrBuf);
   datetime tM3[];
   ArraySetAsSeries(tM3, false);
   int gotT = CopyTime(_Symbol, InpATRTF, 0, m3_count, tM3);
   int msize = MathMin(gotAtr, gotT);
   if(msize < InpBaseLen + 10) return false;  // not enough M3 history yet

   double prefix[];
   ArrayResize(prefix, msize + 1);
   prefix[0] = 0;
   for(int k = 0; k < msize; k++) prefix[k + 1] = prefix[k] + atrBuf[k];

   int jptr = 0;
   int adaptive_tf = 30;
   bool buy_locked = false, sell_locked = false, buy_armed = false, sell_armed = false;
   int last_signal_dir = 0;
   double raw_hist[4] = {50,50,50,50}, k_hist[4] = {50,50,50,50};
   double last_k = 50.0, last_d = 50.0;

   for(int i = 0; i < n; i++)
     {
      while(jptr + 1 < msize && tM3[jptr + 1] <= t30[i]) jptr++;
      int w = MathMin(InpBaseLen, jptr + 1);
      double avg = (prefix[jptr + 1] - prefix[jptr + 1 - w]) / w;
      double ratio = (avg > 0) ? atrBuf[jptr] / avg : 1.0;
      double use = (ratio >= 0.95 && ratio <= 1.05) ? 1.0 : ratio;
      int rawtf = (int)MathRound(30.0 * use);
      rawtf = (int)MathMax(15, MathMin(45, rawtf));
      int smooth = (int)MathRound(adaptive_tf * 0.70 + rawtf * 0.30);
      int step = (int)MathMax(-2, MathMin(2, smooth - adaptive_tf));
      adaptive_tf = (int)MathMax(15, MathMin(45, adaptive_tf + step));
      int klen = (int)MathMax(2, MathMin(10, (int)MathRound(5.0 * adaptive_tf / 30.0)));
      int kuse = MathMin(klen, i + 1);

      double hi = -DBL_MAX, lo = DBL_MAX;
      for(int k2 = i - kuse + 1; k2 <= i; k2++) { hi = MathMax(hi, h30[k2]); lo = MathMin(lo, l30[k2]); }
      double raw = (hi > lo) ? 100.0 * (c30[i] - lo) / (hi - lo) : 50.0;

      raw_hist[3]=raw_hist[2]; raw_hist[2]=raw_hist[1]; raw_hist[1]=raw_hist[0]; raw_hist[0]=raw;
      double kk = (raw_hist[0] + raw_hist[1] + raw_hist[2]) / 3.0;
      k_hist[3]=k_hist[2]; k_hist[2]=k_hist[1]; k_hist[1]=k_hist[0]; k_hist[0]=kk;
      double dd = (k_hist[0] + k_hist[1] + k_hist[2]) / 3.0;

      if(kk <= LVL20) { if(!buy_locked) buy_armed = true; sell_locked = false; }
      if(kk >= LVL80) { if(!sell_locked) sell_armed = true; buy_locked = false; }
      bool bc = (last_k <= last_d && kk > dd && kk <= LVL25 && dd <= LVL25);
      bool sc = (last_k >= last_d && kk < dd && kk >= LVL75 && dd >= LVL75);
      if(bc && buy_armed && !buy_locked) { buy_locked=true; buy_armed=false; last_signal_dir=1; }
      else if(sc && sell_armed && !sell_locked) { sell_locked=true; sell_armed=false; last_signal_dir=-1; }

      last_k = kk; last_d = dd;
     }

   g_adaptive_tf = adaptive_tf;
   g_k_len = (int)MathMax(2, MathMin(10, (int)MathRound(5.0 * adaptive_tf / 30.0)));
   g_raw_hist[0]=raw_hist[0]; g_raw_hist[1]=raw_hist[1]; g_raw_hist[2]=raw_hist[2]; g_raw_hist[3]=raw_hist[3];
   g_k_hist[0]=k_hist[0];     g_k_hist[1]=k_hist[1];     g_k_hist[2]=k_hist[2];     g_k_hist[3]=k_hist[3];
   g_k = last_k; g_d = last_d;
   g_prev_k = (raw_hist[1] + raw_hist[2] + raw_hist[3]) / 3.0;
   g_prev_d = (k_hist[1] + k_hist[2] + k_hist[3]) / 3.0;
   g_last_history_signal=last_signal_dir;
   if(last_signal_dir==-1)
     { g_buy_armed=true; g_buy_locked=false; g_sell_armed=false; g_sell_locked=true; }
   else if(last_signal_dir==1)
     { g_sell_armed=true; g_sell_locked=false; g_buy_armed=false; g_buy_locked=true; }
   else
     {
      bool choose_buy=(last_k<=50.0);
      g_buy_armed=choose_buy; g_buy_locked=!choose_buy;
      g_sell_armed=!choose_buy; g_sell_locked=choose_buy;
     }

   Print("STOCHEXTREME HISTORY REBUILT (bars=", n, "): adaptive_tf=", g_adaptive_tf, " k_len=", g_k_len,
         " k=", DoubleToString(g_k,2), " d=", DoubleToString(g_d,2),
         " buy_armed=", BoolText(g_buy_armed), " sell_armed=", BoolText(g_sell_armed),
         " buy_locked=", BoolText(g_buy_locked), " sell_locked=", BoolText(g_sell_locked));
   return true;
  }

// Crude same-length fallback, only used if BuildHistoryState() can't get
// enough M3/M30 history (e.g. right after adding the symbol, thin history).
void SeedSeries()
  {
   for(int j = 0; j < 4; j++) { g_raw_hist[j] = 50.0; g_k_hist[j] = 50.0; }
   int len = 5;
   for(int shift = 10; shift >= 1; shift--)
     {
      double r = RawStochSlow(len, shift);
      if(r == EMPTY_VALUE) continue;
      g_raw_hist[3] = g_raw_hist[2]; g_raw_hist[2] = g_raw_hist[1];
      g_raw_hist[1] = g_raw_hist[0]; g_raw_hist[0] = r;
      double k = (g_raw_hist[0] + g_raw_hist[1] + g_raw_hist[2]) / 3.0;
      g_k_hist[3] = g_k_hist[2]; g_k_hist[2] = g_k_hist[1];
      g_k_hist[1] = g_k_hist[0]; g_k_hist[0] = k;
     }
   g_k = (g_raw_hist[0] + g_raw_hist[1] + g_raw_hist[2]) / 3.0;
   g_d = (g_k_hist[0] + g_k_hist[1] + g_k_hist[2]) / 3.0;
   g_prev_k = g_k;
   g_prev_d = g_d;
   Print("STOCHEXTREME WARNING: BuildHistoryState failed, using crude fixed-length-5 seed (not history-accurate)");
  }

bool RecalculateKD(bool force_closed, bool want_shift, bool &did_shift)
  {
   did_shift = false;
   double atr, base;
   if(!GetAtrNowAndBase(atr, base)) return false;
   double ratio = atr / base;
   double ru = (ratio >= 0.95 && ratio <= 1.05) ? 1.0 : ratio;
   int raw_tf = (int)MathRound(30.0 * ru);
   raw_tf = (int)MathMax(15, MathMin(45, raw_tf));
   int smooth = (int)MathRound(g_adaptive_tf * 0.70 + raw_tf * 0.30);
   int step = (int)MathMax(-2, MathMin(2, smooth - g_adaptive_tf));
   g_adaptive_tf = (int)MathMax(15, MathMin(45, g_adaptive_tf + step));
   g_k_len = (int)MathMax(2, MathMin(10, (int)MathRound(5.0 * g_adaptive_tf / 30.0)));

   int shift = force_closed ? 1 : 0;
   double raw = RawStochFast(g_k_len, shift);
   if(raw == EMPTY_VALUE) return false;

   // Shift smoothing histories once per M30 bar. Gated by g_pending_shift
   // (persistent across ticks) rather than a one-shot "new_bar" flag: if
   // GetAtrNowAndBase()/RawStochFast() above fail on the exact tick a bar
   // closes, the old code lost that shift forever (g_prev_k stayed stale
   // for the whole next bar, so the M30-close target check silently
   // compared against the WRONG bar). Now it just retries next tick until
   // it fully succeeds - did_shift/g_pending_shift are only ever cleared
   // once every step below has actually happened, never on a partial fail.
   if(want_shift)
     {
      g_raw_hist[3] = g_raw_hist[2]; g_raw_hist[2] = g_raw_hist[1]; g_raw_hist[1] = g_raw_hist[0];
      g_k_hist[3]   = g_k_hist[2];   g_k_hist[2]   = g_k_hist[1];   g_k_hist[1]   = g_k_hist[0];
     }

   g_raw_hist[0] = raw;
   g_k = (g_raw_hist[0] + g_raw_hist[1] + g_raw_hist[2]) / 3.0;
   g_k_hist[0] = g_k;
   g_d = (g_k_hist[0] + g_k_hist[1] + g_k_hist[2]) / 3.0;

   // Previous values from last completed bar (for crossover detection)
   g_prev_k = (g_raw_hist[1] + g_raw_hist[2] + g_raw_hist[3]) / 3.0;
   g_prev_d = (g_k_hist[1] + g_k_hist[2] + g_k_hist[3]) / 3.0;

   if(want_shift) { did_shift = true; g_pending_shift = false; }
   return true;
  }

// Exact K/D snapshot of the M30 bar that has just closed.
bool CaptureClosedM30Snapshot()
  {
   datetime close_time=iTime(_Symbol,InpWorkTF,0);
   if(close_time<=0) return false;
   double raw=RawStochSlow(g_k_len,1);
   if(raw==EMPTY_VALUE || !MathIsValidNumber(raw)) return false;
   g_closed_k=(raw+g_raw_hist[1]+g_raw_hist[2])/3.0;
   g_closed_d=(g_closed_k+g_k_hist[1]+g_k_hist[2])/3.0;
   if(!MathIsValidNumber(g_closed_k)||!MathIsValidNumber(g_closed_d)) return false;
   g_closed_bar_close_time=close_time;
   g_closed_snapshot_ready=true;
   g_closed_snapshot_pending=false;
   Event("CLOSED_M30_SNAPSHOT",0,"k="+DoubleToString(g_closed_k,8)+" d="+DoubleToString(g_closed_d,8));
   return true;
  }

//===================================================================
//                     SESSION FILTER (ET + DST)
//===================================================================
int NthSunday(int y, int m, int nth)
  {
   MqlDateTime z;
   ZeroMemory(z);
   z.year = y; z.mon = m; z.day = 1;
   datetime t = StructToTime(z);
   TimeToStruct(t, z);
   return 1 + ((7 - z.day_of_week) % 7) + (nth - 1) * 7;
  }

bool IsNewYorkDST(datetime utc)
  {
   MqlDateTime z;
   TimeToStruct(utc, z);
   MqlDateTime a;
   ZeroMemory(a); a.year = z.year; a.mon = 3; a.day = NthSunday(z.year, 3, 2); a.hour = 7;
   datetime start = StructToTime(a);
   ZeroMemory(a); a.year = z.year; a.mon = 11; a.day = NthSunday(z.year, 11, 1); a.hour = 6;
   datetime finish = StructToTime(a);
   return utc >= start && utc < finish;
  }

datetime ToNewYork(datetime server_time)
  {
   datetime utc = server_time - InpServerUtcOffsetHours * 3600;
   int off = (InpUseNewYorkDST && IsNewYorkDST(utc)) ? -4 : -5;
   return utc + off * 3600;
  }

int SessionBucket(datetime server_time)
  {
   MqlDateTime z;
   TimeToStruct(ToNewYork(server_time), z);
   int m = z.hour * 60 + z.min;
   if(m >= 18 * 60 || m < 3 * 60)  return 1;   // Overnight 18:00-03:00 ET
   if(m < 8 * 60)                   return 2;   // Europe 03:00-08:00 ET
   if(m < 9 * 60 + 30)              return 3;   // Premarket 08:00-09:30 ET
   if(m < 11 * 60 + 30)             return 4;   // NY open 09:30-11:30 ET
   if(m < 14 * 60)                  return 5;   // Midday 11:30-14:00 ET
   if(m < 16 * 60 + 30)             return 6;   // Afternoon 14:00-16:30 ET
   return 7;                                    // Postmarket 16:30-18:00 ET
  }

bool EntrySessionAllowed(datetime server_time)
  {
   if(InpSessionFilter == Q_SESSION_ALL) return true;
   int bucket = SessionBucket(server_time);
   if(InpSessionFilter == Q_EXCLUDE_MIDDAY_AND_OVERNIGHT)
      return bucket != Q_EXCLUDE_OVERNIGHT && bucket != Q_EXCLUDE_US_MIDDAY;
   return bucket != (int)InpSessionFilter;
  }

//===================================================================
//                  SIGNAL STATE MACHINE
//===================================================================
// Hard invariant: the EA must never remain with both entry sides unarmed.
// This state belongs to the EA and is independent from the visual indicator panel.
void EnsureOneSideArmed()
  {
   if(g_buy_armed || g_sell_armed) return;
   if(g_sell_locked || g_last_history_signal==-1)
     {
      g_buy_armed=true; g_buy_locked=false;
      g_sell_armed=false; g_sell_locked=true;
      return;
     }
   if(g_buy_locked || g_last_history_signal==1)
     {
      g_sell_armed=true; g_sell_locked=false;
      g_buy_armed=false; g_buy_locked=true;
      return;
     }
   bool choose_buy=(g_k<=50.0);
   g_buy_armed=choose_buy; g_buy_locked=!choose_buy;
   g_sell_armed=!choose_buy; g_sell_locked=choose_buy;
  }

void ApplyArmAndRearm(bool completed_m30_close)
  {
   // The selected entry model now controls the origin condition correctly.
   // INTRABAR: a live K touch at 20/80 arms the corresponding cycle.
   // CLOSED: only the K value of the completed M30 bar can arm it.
   bool evaluate=false;
   double origin_k=50.0;
   string source="";

   if(InpEntryModel==Q_PINE_INTRABAR_ORIGIN)
     {
      if(InpCalculationMode!=Q_LIVE_INTRABAR) return;
      evaluate=true;
      origin_k=g_k;
      source="live intrabar";
     }
   else if(completed_m30_close)
     {
      evaluate=true;
      origin_k=g_prev_k;
      source="closed M30";
     }

   if(!evaluate) return;

   if(origin_k<=LVL20)
     {
      // Reaching the opposite extreme ends the previous SELL lock first.
      if(g_sell_locked)
        {
         g_sell_locked=false;
         Event("SELL_UNLOCKED",-1,source+" K<=20");
        }
      if(!g_buy_locked && !g_buy_armed)
        {
         g_buy_armed=true;
         Event("BUY_ARMED",1,source+" K<=20");
        }
     }

   if(origin_k>=LVL80)
     {
      // Reaching the opposite extreme ends the previous BUY lock first.
      if(g_buy_locked)
        {
         g_buy_locked=false;
         Event("BUY_UNLOCKED",1,source+" K>=80");
        }
      if(!g_sell_locked && !g_sell_armed)
        {
         g_sell_armed=true;
         Event("SELL_ARMED",-1,source+" K>=80");
        }
     }
  }

void DetectCross()
  {
   if(!g_series_ready || g_pending_dir != 0) return;

   bool buy_cross  = (g_prev_k <= g_prev_d && g_k > g_d && g_k <= LVL25 && g_d <= LVL25);
   bool sell_cross = (g_prev_k >= g_prev_d && g_k < g_d && g_k >= LVL75 && g_d >= LVL75);
   int dir=0;
   if(buy_cross && g_buy_armed && !g_buy_locked) dir=1;
   else if(sell_cross && g_sell_armed && !g_sell_locked) dir=-1;
   if(dir==0) return;

   Event(dir>0?"BUY_CROSS":"SELL_CROSS",dir,"actionable cross; independent overlap enabled");
   g_pending_dir=dir;
   g_pending_start=TimeCurrent();
   g_pending_signal_time=g_pending_start;

   // Fundamental overlap rule: if the opposite cycle is still open, the new
   // already-valid cross is executed immediately. No extra 60-second penalty.
   if(OppositeTradeActive(dir) && !SideAlreadyActive(dir))
     {
      Event("OVERLAP_SIGNAL_IMMEDIATE",dir,"opposite position still active; opening independent cycle");
      if(StartTrade(dir)) ClearPendingState();
      else
        {
         g_pending_confirmed=true;
         g_pending_first_retry=TimeCurrent();
         g_pending_retries=1;
        }
      return;
     }

   if(SideAlreadyActive(dir))
     {
      Event("SAME_SIDE_SIGNAL_BLOCKED",dir,"one active cycle per side; rearms remain unchanged");
      ClearPendingState();
      return;
     }

   Event("CONFIRMATION_STARTED",dir,"waiting "+IntegerToString(InpConfirmSec)+" seconds");
  }

//===================================================================
//                   TRADE EXECUTION (ROBUST)
//===================================================================
void ClearPendingState()
  {
   g_pending_dir = 0;
   g_pending_start = 0;
   g_pending_signal_time = 0;
   g_pending_confirmed = false;
   g_pending_retries = 0;
   g_pending_first_retry = 0;
  }

bool StartTrade(int dir)
  {
   //--- Pre-flight checks with Alert() for every failure ---
   string fail = "";
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      fail = "AUTOTRADING DESACTIVADO en terminal (boton AlgoTrading)";
   else if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      fail = "EA sin permiso: activa 'Permitir trading algoritmico' en propiedades del EA";
   else if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
      fail = "Cuenta en modo solo-lectura, no permite operar";
   else if(SymbolInfoInteger(_Symbol, SYMBOL_TRADE_MODE) != SYMBOL_TRADE_MODE_FULL)
      fail = "Simbolo " + _Symbol + " no permite operar (mercado cerrado o close-only)";

   if(fail != "")
     {
      Alert("QUANTORA ERROR: ", fail);
      Print("QUANTORA START_TRADE_FAILED: ", fail);
      Event("START_TRADE_FAILED", dir, fail);
      return false;
     }

   //--- Get current price ---
   MqlTick q;
   if(!SymbolInfoTick(_Symbol, q))
     {
      Alert("QUANTORA ERROR: No se pudo obtener precio (SymbolInfoTick fallo)");
      Event("START_TRADE_FAILED", dir, "SymbolInfoTick failed");
      return false;
     }

   // Independent overlap requires a HEDGING account in real mode. Netting
   // accounts cannot keep BUY and SELL as separate positions on one symbol.
   if(InpExecutionMode==Q_REAL_ORDERS &&
      AccountInfoInteger(ACCOUNT_MARGIN_MODE)!=ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
     {
      Event("START_TRADE_FAILED",dir,"independent overlap requires HEDGING account");
      Alert("QUANTORA ABORT: Independent overlap requires a HEDGING account.");
      return false;
     }
   if((dir>0 && g_buy_locked) || (dir<0 && g_sell_locked))
     {
      string unlock_source=(InpEntryModel==Q_PINE_INTRABAR_ORIGIN ? "live K" : "CLOSED M30 K");
      Event("START_TRADE_BLOCKED_STRICT_CYCLE",dir,
            dir>0 ? "BUY locked until "+unlock_source+">=80"
                  : "SELL locked until "+unlock_source+"<=20");
      return false;
     }
   if(SideAlreadyActive(dir))
     {
      Event("START_TRADE_BLOCKED_SAME_SIDE",dir,"one active position per direction");
      return false;
     }

   double entry_volume = CalculateEntryVolume(true);
   string volume_why;
   if(entry_volume <= 0.0 || !IsVolumeValid(entry_volume, volume_why))
     {
      string msg = "Dynamic volume invalid: " + volume_why;
      Alert("QUANTORA ERROR: ", msg);
      Event("START_TRADE_FAILED", dir, msg);
      return false;
     }
   double entry = dir > 0 ? q.ask : q.bid;
   double stop = NormalizeToTick(dir > 0 ? entry - InpStopPriceDistance : entry + InpStopPriceDistance);

   //--- Send order ---
   bool ok = true;
   if(InpExecutionMode == Q_REAL_ORDERS)
     {
      g_trade.SetExpertMagicNumber(InpMagic);
      g_trade.SetDeviationInPoints((ulong)MathMax(1, MathRound(InpDeviationTicks * TickSize() / _Point)));
      g_trade.SetTypeFilling(ORDER_FILLING_IOC);

      ok = dir > 0
           ? g_trade.Buy(entry_volume, _Symbol, entry, stop, 0.0, "StochExtreme BUY")
           : g_trade.Sell(entry_volume, _Symbol, entry, stop, 0.0, "StochExtreme SELL");

      if(!ok)
        {
         uint retcode = g_trade.ResultRetcode();
         string desc = g_trade.ResultRetcodeDescription();
         string msg = "Orden rechazada: retcode=" + IntegerToString(retcode) + " " + desc;
         Alert("QUANTORA ERROR: ", msg);
         Print("QUANTORA ORDER_REJECTED: ", msg);
         Event("ORDER_REJECTED", dir, msg);
         return false;
        }

      // Brief wait for broker to register position
      Sleep(100);

      ulong my_ticket = 0;
      if(SelectNewestOwnPositionForDirection(dir,my_ticket))
        {
         entry = PositionGetDouble(POSITION_PRICE_OPEN);
         stop  = PositionGetDouble(POSITION_SL);
        }
     }

   //--- Initialize trade state ---
   bool using_second=false;
   if(g_ts.active && !g_ts2.active){ SwapTradeContexts(); using_second=true; }
   if(g_ts.active)
     {
      Event("START_TRADE_FAILED",dir,"both independent slots occupied");
      if(using_second) SwapTradeContexts();
      return false;
     }
   ZeroMemory(g_ts);
   g_ts.active       = true;
   g_ts.trade_id     = g_next_trade_id++;
   g_ts.dir          = dir;
   g_ts.position_id  = 0;
   if(InpExecutionMode == Q_REAL_ORDERS)
     {
      ulong my_ticket2 = 0;
      if(SelectNewestOwnPositionForDirection(dir,my_ticket2))
         g_ts.position_id = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
     }
   g_ts.signal_time   = g_pending_signal_time;
   g_ts.confirm_time  = TimeCurrent();
   g_ts.entry_time    = q.time;
   g_ts.entry_time_msc = q.time_msc;
   g_ts.entry_bid     = q.bid;
   g_ts.entry_ask     = q.ask;
   g_ts.entry_price   = entry;
   g_ts.volume        = entry_volume;
   g_ts.stop_price    = stop;
   g_ts.initial_stop  = stop;
   g_ts.entry_k       = g_k;
   g_ts.entry_d       = g_d;
   g_ts.entry_adaptive_tf = g_adaptive_tf;
   g_ts.entry_k_len   = g_k_len;
   g_ts.peak_price    = dir > 0 ? q.bid : q.ask;  // Initialize peak
   g_ts.mae_points    = 0.0;
   g_ts.mfe_points    = 0.0;
   g_ts.giveback_active = false;
   g_ts.giveback_level  = 0;
   g_target_exit_latched = false;
   g_target_exit_reason = "";
   g_target_exit_k = 0.0;
   g_target_exit_d = 0.0;
   g_target_exit_time = 0;

   // Lock the side that was used
   if(dir > 0) { g_buy_locked = true;  g_buy_armed = false;  }
   else        { g_sell_locked = true;  g_sell_armed = false; }

   Alert("QUANTORA TRADE ABIERTO: ", DirText(dir), " ", _Symbol,
         " entry=", DoubleToString(entry, _Digits),
         " SL=", DoubleToString(stop, _Digits));
   Event("POSITION_OPENED", dir,
         "position_id=" + IntegerToString((long)g_ts.position_id) +
         " entry=" + DoubleToString(entry, _Digits) +
         " stop=" + DoubleToString(stop, _Digits) +
         " volume=" + DoubleToString(entry_volume, VolumeDigits(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP))));
   if(using_second) SwapTradeContexts();
   return true;
  }

//===================================================================
//                   CONFIRMATION + RETRY
//===================================================================
void CheckConfirmation()
  {
   if(g_pending_dir == 0) return;

   // Still waiting for 60 seconds and not yet confirmed
   if(!g_pending_confirmed && (int)(TimeCurrent() - g_pending_start) < InpConfirmSec)
      return;

   int dir = g_pending_dir;

   //--- First time past 60s: validate condition ---
   if(!g_pending_confirmed)
     {
      bool valid = (dir > 0) ? (g_k > g_d && g_k <= LVL25 && g_d <= LVL25)
                              : (g_k < g_d && g_k >= LVL75 && g_d >= LVL75);
      if(!valid)
        {
         Event("CONFIRMATION_CANCELLED", dir, "condition invalid at decision time");
         ClearPendingState();
         return;
        }
      if(!EntrySessionAllowed(TimeCurrent()))
        {
         Event("SESSION_BLOCKED", dir,
               "ET=" + TimeToString(ToNewYork(TimeCurrent()), TIME_DATE | TIME_SECONDS) +
               " filter=" + EnumToString(InpSessionFilter));
         ClearPendingState();
         return;
        }
      // Condition and session OK: mark confirmed
      g_pending_confirmed = true;
      g_pending_first_retry = TimeCurrent();
      g_pending_retries = 0;
      Event("CONFIRMATION_PASSED", dir, "persistent at decision time");
     }

   //--- Attempt to open position (with retries) ---
   if(g_pending_confirmed)
     {
      // Retry limit: 30 seconds max
      if((int)(TimeCurrent() - g_pending_first_retry) > MAX_RETRY_SEC)
        {
         Alert("QUANTORA ABORT: No se pudo abrir ", DirText(dir),
               " tras ", MAX_RETRY_SEC, "s de reintentos. Revisa permisos/conexion.");
         Event("TRADE_RETRY_EXHAUSTED", dir,
               IntegerToString(MAX_RETRY_SEC) + "s of retries failed");
         ClearPendingState();
         return;
        }

      g_pending_retries++;
      if(StartTrade(dir))
         ClearPendingState();  // Success: clean up
      // If failed, pending state stays → retry on next tick
     }
  }

//===================================================================
//               POSITION TRACKING & HISTORY
//===================================================================
bool PositionOpenById(ulong position_id)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == position_id &&
         (ulong)PositionGetInteger(POSITION_MAGIC) == InpMagic &&
         PositionGetString(POSITION_SYMBOL) == _Symbol)
         return true;
     }
   return false;
  }

// Selects THIS EA's own position on _Symbol (matching magic AND, whenever
// g_ts is tracking one, the exact position_id). Filtering by symbol+magic
// alone is unsafe the moment more than one position with that magic can
// exist on this symbol at once (leftover/orphaned position after a restart,
// a duplicate fill, two EAs sharing a magic by mistake, a hedging account,
// etc.) — it can silently grab the WRONG ticket, closing/modifying a
// position that isn't the one the strategy logic intended, while the real
// target-hit position is left open forever. If want_position_id != 0, only
// an EXACT position_id match is accepted (no silent fallback). If it is 0
// (used only during RecoverState / right after StartTrade, before g_ts has
// a definitive single owner), we fall back to symbol+magic but Alert loudly
// if more than one candidate exists, since that ambiguity is itself a bug.

bool SelectNewestOwnPositionForDirection(int dir, ulong &ticket)
  {
   ticket=0; long best_time=-1;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong t=PositionGetTicket(i); if(t==0) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
      long typ=PositionGetInteger(POSITION_TYPE);
      if((dir>0 && typ!=POSITION_TYPE_BUY)||(dir<0 && typ!=POSITION_TYPE_SELL)) continue;
      ulong pid=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
      if((g_ts.active && g_ts.position_id==pid)||(g_ts2.active && g_ts2.position_id==pid)) continue;
      long tm=PositionGetInteger(POSITION_TIME_MSC);
      if(tm>best_time){best_time=tm;ticket=t;}
     }
   return ticket!=0 && PositionSelectByTicket(ticket);
  }

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

   if(want_position_id != 0) return false;  // exact match required, not found

   if(matches > 1)
      Alert("QUANTORA WARNING: ", matches, " posiciones propias (symbol+magic=",
            InpMagic, ") detectadas simultaneamente en ", _Symbol,
            " — revisa manualmente, puede haber una huerfana sin gestionar.");

   ticket = fallback_ticket;
   return ticket != 0;
  }

string DealReasonText(long reason)
  {
   if(reason == DEAL_REASON_SL)       return "SL";
   if(reason == DEAL_REASON_TP)       return "TP";
   if(reason == DEAL_REASON_EXPERT)   return "EXPERT";
   if(reason == DEAL_REASON_CLIENT)   return "CLIENT";
   if(reason == DEAL_REASON_MOBILE)   return "MOBILE";
   if(reason == DEAL_REASON_WEB)      return "WEB";
   if(reason == DEAL_REASON_ROLLOVER) return "ROLLOVER";
   if(reason == DEAL_REASON_VMARGIN)  return "VMARGIN";
   if(reason == DEAL_REASON_SPLIT)    return "SPLIT";
   return "OTHER_" + IntegerToString(reason);
  }

bool PositionDealTotals(ulong position_id, datetime from, datetime to,
                        double &profit, double &commission, double &swap,
                        double &exit_price, datetime &exit_time,
                        long &exit_time_msc, long &exit_reason)
  {
   profit = commission = swap = 0.0;
   exit_price = 0.0; exit_time = 0; exit_time_msc = 0; exit_reason = -1;
   if(position_id == 0 || !HistorySelect(from - 86400, to + 86400)) return false;
   int matched = 0, total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      if((ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID) != position_id) continue;
      matched++;
      profit     += HistoryDealGetDouble(ticket, DEAL_PROFIT);
      commission += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      swap       += HistoryDealGetDouble(ticket, DEAL_SWAP);
      long entry = (long)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY || entry == DEAL_ENTRY_INOUT)
        {
         long tm = (long)HistoryDealGetInteger(ticket, DEAL_TIME_MSC);
         if(tm >= exit_time_msc)
           {
            exit_time_msc = tm;
            exit_time     = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
            exit_price    = HistoryDealGetDouble(ticket, DEAL_PRICE);
            exit_reason   = (long)HistoryDealGetInteger(ticket, DEAL_REASON);
           }
        }
     }
   return matched > 0 && exit_time_msc > 0 && exit_price > 0.0;
  }

bool CompleteTradeFromHistory(string requested_reason, string requested_structural)
  {
   if(!g_ts.active) return false;
   MqlTick q;
   if(!SymbolInfoTick(_Symbol, q)) return false;
   double deal_profit = 0.0, comm = 0.0, swap = 0.0, exit_price = 0.0;
   datetime exit_time = 0;
   long exit_time_msc = 0, deal_reason = -1;
   if(!PositionDealTotals(g_ts.position_id, g_ts.entry_time, q.time,
                          deal_profit, comm, swap, exit_price, exit_time,
                          exit_time_msc, deal_reason))
      return false;

   string reason = requested_reason;
   string structural = requested_structural;
   string dr = DealReasonText(deal_reason);
   if(reason == "")
     {
      if(deal_reason == DEAL_REASON_SL)
        {
         // Was giveback active when SL hit?
         reason     = g_ts.giveback_active ? "MFE_GIVEBACK_STOP" : "INITIAL_STOP";
         structural = g_ts.giveback_active ? "WIN" : "LOSS";
        }
      else
        { reason = "BROKER_EXTERNAL_CLOSE_" + dr; structural = "LOSS"; }
     }

   double net = deal_profit + comm + swap;
   double calc_pnl = 0.0;
   ENUM_ORDER_TYPE typ = g_ts.dir > 0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   if(!OrderCalcProfit(typ, _Symbol, g_ts.volume, g_ts.entry_price, exit_price, calc_pnl))
     {
      Event("PNL_CALC_FAILED", g_ts.dir, "error=" + IntegerToString(GetLastError()));
      calc_pnl = deal_profit;
     }
   double pnl_disc = deal_profit - calc_pnl;
   string economic = net > 0.005 ? "PROFIT" : net < -0.005 ? "LOSS" : "BREAKEVEN";
   double signed_move = g_ts.dir > 0 ? exit_price - g_ts.entry_price : g_ts.entry_price - exit_price;
   double ticks_move = signed_move / TickSize();
   double rm = InpStopPriceDistance > 0 ? signed_move / InpStopPriceDistance : 0.0;
   double slippage = 0.0;
   if(reason == "INITIAL_STOP")
      slippage = g_ts.dir > 0 ? g_ts.initial_stop - exit_price : exit_price - g_ts.initial_stop;

   FileWrite(g_f_trades, g_ts.trade_id, g_ts.position_id, g_run_id, _Symbol, DirText(g_ts.dir),
             TimeToString(g_ts.signal_time, TIME_DATE | TIME_SECONDS),
             TimeToString(g_ts.confirm_time, TIME_DATE | TIME_SECONDS),
             TimeToString(g_ts.entry_time, TIME_DATE | TIME_SECONDS), g_ts.entry_time_msc,
             DoubleToString(g_ts.entry_bid, _Digits), DoubleToString(g_ts.entry_ask, _Digits),
             DoubleToString(g_ts.entry_price, _Digits), g_ts.volume,
             DoubleToString(g_ts.initial_stop, _Digits), DoubleToString(g_ts.stop_price, _Digits),
             TimeToString(exit_time, TIME_DATE | TIME_SECONDS), exit_time_msc,
             DoubleToString(q.bid, _Digits), DoubleToString(q.ask, _Digits),
             DoubleToString(exit_price, _Digits),
             reason, structural, economic, deal_profit, comm, swap, net, calc_pnl, pnl_disc,
             signed_move, ticks_move, rm, (long)(exit_time - g_ts.entry_time),
             g_ts.entry_k, g_ts.entry_d, g_ts.entry_adaptive_tf, g_ts.entry_k_len,
             g_ts.target_closed_k, g_ts.target_closed_d, g_k, g_d,
             g_ts.mae_points, g_ts.mfe_points, g_ts.giveback_level,
             g_ts.entry_ask - g_ts.entry_bid, q.ask - q.bid, slippage, dr);

   g_closed_trades++;
   if(structural == "WIN") g_struct_wins++; else g_struct_losses++;
   g_net_profit += net;
   if(net > 0) g_gross_profit += net; else g_gross_loss += -net;

   Event("POSITION_CLOSED", g_ts.dir,
         reason + " net=" + DoubleToString(net, 2) + " giveback_level=" + IntegerToString(g_ts.giveback_level) +
         " deal_reason=" + dr);
   g_ts.active = false;
   g_ts.close_pending = false;
   return true;
  }

void CompleteVirtualTrade(string reason, string structural)
  {
   if(!g_ts.active) return;
   MqlTick q;
   if(!SymbolInfoTick(_Symbol, q)) return;
   double exit_price = g_ts.dir > 0 ? q.bid : q.ask;
   double profit = 0.0;
   ENUM_ORDER_TYPE typ = g_ts.dir > 0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   if(!OrderCalcProfit(typ, _Symbol, g_ts.volume, g_ts.entry_price, exit_price, profit))
     {
      Event("PNL_CALC_FAILED", g_ts.dir, "virtual error=" + IntegerToString(GetLastError()));
      return;
     }
   string economic = profit > 0.005 ? "PROFIT" : profit < -0.005 ? "LOSS" : "BREAKEVEN";
   double signed_move = g_ts.dir > 0 ? exit_price - g_ts.entry_price : g_ts.entry_price - exit_price;
   double slippage = 0.0;
   if(reason == "INITIAL_STOP")
      slippage = g_ts.dir > 0 ? g_ts.initial_stop - exit_price : exit_price - g_ts.initial_stop;

   FileWrite(g_f_trades, g_ts.trade_id, 0, g_run_id, _Symbol, DirText(g_ts.dir),
             TimeToString(g_ts.signal_time, TIME_DATE | TIME_SECONDS),
             TimeToString(g_ts.confirm_time, TIME_DATE | TIME_SECONDS),
             TimeToString(g_ts.entry_time, TIME_DATE | TIME_SECONDS), g_ts.entry_time_msc,
             DoubleToString(g_ts.entry_bid, _Digits), DoubleToString(g_ts.entry_ask, _Digits),
             DoubleToString(g_ts.entry_price, _Digits), g_ts.volume,
             DoubleToString(g_ts.initial_stop, _Digits), DoubleToString(g_ts.stop_price, _Digits),
             TimeToString(q.time, TIME_DATE | TIME_SECONDS), q.time_msc,
             DoubleToString(q.bid, _Digits), DoubleToString(q.ask, _Digits),
             DoubleToString(exit_price, _Digits),
             reason, structural, economic, profit, 0.0, 0.0, profit, profit, 0.0,
             signed_move, signed_move / TickSize(),
             InpStopPriceDistance > 0 ? signed_move / InpStopPriceDistance : 0.0,
             (long)(q.time - g_ts.entry_time),
             g_ts.entry_k, g_ts.entry_d, g_ts.entry_adaptive_tf, g_ts.entry_k_len,
             g_ts.target_closed_k, g_ts.target_closed_d, g_k, g_d,
             g_ts.mae_points, g_ts.mfe_points, g_ts.giveback_level,
             g_ts.entry_ask - g_ts.entry_bid, q.ask - q.bid, slippage, "VIRTUAL");

   g_closed_trades++;
   if(structural == "WIN") g_struct_wins++; else g_struct_losses++;
   g_net_profit += profit;
   if(profit > 0) g_gross_profit += profit; else g_gross_loss += -profit;

   Event("VIRTUAL_POSITION_CLOSED", g_ts.dir, reason + " net=" + DoubleToString(profit, 2));
   g_ts.active = false;
  }

//===================================================================
//               CLOSE REQUEST + SYNC
//===================================================================
void RequestClose(string reason, string structural)
  {
   if(!g_ts.active || g_ts.close_pending) return;
   if(InpExecutionMode == Q_VIRTUAL_ONLY)
     { CompleteVirtualTrade(reason, structural); return; }
   g_trade.SetExpertMagicNumber(InpMagic);
   ulong close_ticket = 0;
   if(!SelectOwnPosition(close_ticket, g_ts.position_id))
     {
      Event("CLOSE_REJECTED", g_ts.dir,
            "exact position_id=" + IntegerToString((long)g_ts.position_id) + " not found to close");
      return;
     }
   bool sent = g_trade.PositionClose(close_ticket);
   uint retcode = g_trade.ResultRetcode();
   bool accepted = sent &&
                   (retcode == TRADE_RETCODE_DONE ||
                    retcode == TRADE_RETCODE_DONE_PARTIAL ||
                    retcode == TRADE_RETCODE_PLACED);
   if(!accepted)
     {
      Event("CLOSE_REJECTED_RETRYING", g_ts.dir,
            "retcode=" + IntegerToString((int)retcode) +
            " " + g_trade.ResultRetcodeDescription() +
            " target remains latched");
      return;
     }
   g_ts.close_pending = true;
   g_ts.close_reason = reason;
   g_ts.close_structural = structural;
   g_ts.close_request_time = TimeCurrent();
   Event("CLOSE_REQUESTED", g_ts.dir,
         reason + " position_id=" + IntegerToString((long)g_ts.position_id));
  }

void SyncTradeState()
  {
   if(!g_ts.active || InpExecutionMode != Q_REAL_ORDERS) return;
   if(PositionOpenById(g_ts.position_id))
     {
      if(g_ts.close_pending && (int)(TimeCurrent()-g_ts.close_request_time)>=5)
        { g_ts.close_pending=false; Event("CLOSE_ACK_TIMEOUT_RETRY",g_ts.dir,"position still open"); }
      return;
     }
   // Position disappeared — completed by broker (SL, TP, external)
   string reason = g_ts.close_pending ? g_ts.close_reason : "";
   string structural = g_ts.close_pending ? g_ts.close_structural : "";
   if(!CompleteTradeFromHistory(reason, structural))
     {
      if(!g_ts.close_pending)
        {
         g_ts.close_pending = true;
         g_ts.close_reason = "";
         g_ts.close_structural = "";
         g_ts.close_request_time = TimeCurrent();
         Event("EXTERNAL_CLOSE_PENDING", g_ts.dir, "waiting exact exit deal");
        }
     }
  }

//===================================================================
//        MFE GIVEBACK + ACTIVE TRADE MANAGEMENT
//===================================================================
void TightenStopToLevel(double lock_points)
  {
   // Move the broker SL to lock in profits
   double candidate = NormalizeToTick(
      g_ts.dir > 0 ? g_ts.entry_price + lock_points
                    : g_ts.entry_price - lock_points);
   double prior = g_ts.stop_price;

   // Only move SL in the favorable direction
   if(g_ts.dir > 0 && candidate <= prior) return;
   if(g_ts.dir < 0 && candidate >= prior) return;

   g_ts.stop_price = candidate;

   ulong modify_ticket = 0;
   if(InpExecutionMode == Q_REAL_ORDERS && SelectOwnPosition(modify_ticket, g_ts.position_id))
     {
      g_trade.SetExpertMagicNumber(InpMagic);
      if(!g_trade.PositionModify(modify_ticket, candidate, 0.0))
        {
         Print("QUANTORA SL MODIFY REJECTED: ",
               g_trade.ResultRetcode(), " ", g_trade.ResultRetcodeDescription());
         g_ts.stop_price = prior;  // Revert on failure
        }
      else
        {
         Event("SL_MODIFIED", g_ts.dir,
               "new_sl=" + DoubleToString(candidate, _Digits) +
               " lock_pts=" + DoubleToString(lock_points, 1) +
               " level=" + IntegerToString(g_ts.giveback_level));
        }
     }
  }

void UpdateMFEGiveback(const MqlTick &q)
  {
   if(!g_ts.active || g_ts.close_pending) return;

   // Update peak price and MAE/MFE
   double mark = g_ts.dir > 0 ? q.bid : q.ask;

   if(g_ts.dir > 0)
      g_ts.peak_price = MathMax(g_ts.peak_price, mark);
   else
      g_ts.peak_price = MathMin(g_ts.peak_price, mark);

   double mfe = g_ts.dir > 0 ? g_ts.peak_price - g_ts.entry_price
                              : g_ts.entry_price - g_ts.peak_price;
   double move = g_ts.dir > 0 ? mark - g_ts.entry_price
                               : g_ts.entry_price - mark;
   g_ts.mfe_points = MathMax(g_ts.mfe_points, move);
   g_ts.mae_points = MathMax(g_ts.mae_points, -move);

   // Determine highest MFE level reached
   double giveback = 0.0;
   int level = 0;
   if(mfe >= InpMFE_Level3)      { giveback = InpGiveback3; level = 3; }
   else if(mfe >= InpMFE_Level2) { giveback = InpGiveback2; level = 2; }
   else if(mfe >= InpMFE_Level1) { giveback = InpGiveback1; level = 1; }

   if(level > g_ts.giveback_level)
     {
      g_ts.giveback_level = level;
      if(!g_ts.giveback_active)
        {
         g_ts.giveback_active = true;
         Event("MFE_GIVEBACK_ACTIVATED", g_ts.dir,
               "level=" + IntegerToString(level) +
               " mfe=" + DoubleToString(mfe, 1) +
               " giveback=" + DoubleToString(giveback, 1));
        }
      else
        {
         Event("MFE_GIVEBACK_UPGRADED", g_ts.dir,
               "level=" + IntegerToString(level) +
               " mfe=" + DoubleToString(mfe, 1) +
               " giveback=" + DoubleToString(giveback, 1));
        }
     }

   // Move SL to protect profits
   if(giveback > 0.0)
     {
      double lock_points = MathMax(0.0, mfe - giveback);
      TightenStopToLevel(lock_points);
     }

   // In VIRTUAL mode, check if SL/giveback triggered (broker doesn't manage it)
   if(InpExecutionMode == Q_VIRTUAL_ONLY)
     {
      bool sl_hit = (g_ts.dir > 0 ? q.bid <= g_ts.stop_price : q.ask >= g_ts.stop_price);
      if(sl_hit)
        {
         string reason = g_ts.giveback_active ? "MFE_GIVEBACK_STOP" : "INITIAL_STOP";
         string structural = g_ts.giveback_active ? "WIN" : "LOSS";
         CompleteVirtualTrade(reason, structural);
        }
     }
  }

void LatchTargetExit(string reason, double kval, double dval, string source)
  {
   if(!g_ts.active || g_target_exit_latched) return;
   g_target_exit_latched = true;
   g_target_exit_reason = reason;
   g_target_exit_k = kval;
   g_target_exit_d = dval;
   g_target_exit_time = TimeCurrent();
   g_ts.target_closed_k = kval;
   g_ts.target_closed_d = dval;
   Event("TARGET_EXIT_LATCHED", g_ts.dir,
         "source=" + source +
         " k=" + DoubleToString(kval, 4) +
         " threshold=" + (g_ts.dir > 0 ? "80" : "20") +
         " close is now mandatory until completed");
  }

void ProcessLatchedTargetExit()
  {
   if(!g_ts.active || !g_target_exit_latched || g_ts.close_pending) return;
   // If PositionClose is rejected, RequestClose leaves close_pending=false.
   // Therefore this function retries automatically on the next tick and
   // keeps retrying until the request is accepted or SyncTradeState sees
   // that the position has already disappeared.
   RequestClose(g_target_exit_reason, "WIN");
  }

void CheckEarlyTargetWindow(const MqlTick &q)
  {
   if(!InpUseTargetFallback || !g_ts.active || g_ts.close_pending || g_target_exit_latched) return;
   if(InpEarlyTargetSec <= 0 || InpCalculationMode != Q_LIVE_INTRABAR) return;

   datetime bar_open = iTime(_Symbol, InpWorkTF, 0);
   int tf_seconds = PeriodSeconds(InpWorkTF);
   if(bar_open <= 0 || tf_seconds <= 0) return;

   int seconds_left = (int)(bar_open + tf_seconds - q.time);
   if(seconds_left < 0 || seconds_left > InpEarlyTargetSec) return;

   bool target = (g_ts.dir > 0 ? g_k >= LVL80 : g_k <= LVL20);
   if(!target) return;

   string reason = g_ts.dir > 0 ? "TARGET_K80_FINAL_10S" : "TARGET_K20_FINAL_10S";
   LatchTargetExit(reason, g_k, g_d,
                   "FINAL_WINDOW seconds_left=" + IntegerToString(seconds_left));
  }

void CheckTargetFallback()
  {
   if(!InpUseTargetFallback || !g_ts.active || g_ts.close_pending || !g_closed_snapshot_ready) return;
   if(g_closed_bar_close_time<=g_ts.entry_time) return;
   bool target=(g_ts.dir>0 ? g_closed_k>=LVL80 : g_closed_k<=LVL20);
   if(!target) return;
   string reason=g_ts.dir>0 ? "TARGET_K80_M30_CLOSE" : "TARGET_K20_M30_CLOSE";
   LatchTargetExit(reason,g_closed_k,g_closed_d,"EXACT_CLOSED_M30");
  }

//===================================================================
//                     EQUITY TRACKING
//===================================================================
void WriteEquity(bool force = false)
  {
   MqlTick q;
   if(!SymbolInfoTick(_Symbol, q)) return;
   datetime minute = (datetime)(q.time - (q.time % 60));
   if(!force && InpWriteEquityMinute && minute == g_last_equity_minute) return;
   g_last_equity_minute = minute;

   double balance = InpExecutionMode == Q_REAL_ORDERS
                    ? AccountInfoDouble(ACCOUNT_BALANCE)
                    : g_initial_balance + g_net_profit;
   double equity = InpExecutionMode == Q_REAL_ORDERS
                   ? AccountInfoDouble(ACCOUNT_EQUITY)
                   : balance;
   double floating = equity - balance;
   g_peak_equity = MathMax(g_peak_equity, equity);
   double dd = MathMax(0.0, g_peak_equity - equity);
   double ddpct = g_peak_equity > 0.0 ? 100.0 * dd / g_peak_equity : 0.0;
   g_max_dd_abs = MathMax(g_max_dd_abs, dd);
   g_max_dd_pct = MathMax(g_max_dd_pct, ddpct);

   FileWrite(g_f_equity, g_run_id,
             TimeToString(q.time, TIME_DATE | TIME_SECONDS), q.time_msc,
             balance, equity, floating, g_net_profit, dd, ddpct,
             DirText(g_ts.active ? g_ts.dir : 0),
             g_ts.active ? g_ts.trade_id : (g_ts2.active ? g_ts2.trade_id : 0));
  }

//===================================================================
//                     EVENT HANDLERS
//===================================================================
void RecoverState()
  {
   ZeroMemory(g_ts); ZeroMemory(g_ts2);
   int adopted=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      ulong ticket=PositionGetTicket(i); if(ticket==0) continue;
      if(PositionGetString(POSITION_SYMBOL)!=_Symbol) continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC)!=InpMagic) continue;
      int dir=PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY?1:-1;
      if(SideAlreadyActive(dir))
        { Event("RECOVERY_DUPLICATE_SAME_SIDE",dir,"manual reconciliation required ticket="+IntegerToString((long)ticket)); continue; }
      if(adopted>=2) continue;
      if(adopted==1) SwapTradeContexts();
      g_ts.active=true; g_ts.trade_id=g_next_trade_id++;
      g_ts.position_id=(ulong)PositionGetInteger(POSITION_IDENTIFIER);
      g_ts.dir=dir; g_ts.entry_price=PositionGetDouble(POSITION_PRICE_OPEN);
      g_ts.volume=PositionGetDouble(POSITION_VOLUME); g_ts.stop_price=PositionGetDouble(POSITION_SL);
      g_ts.initial_stop=g_ts.stop_price; g_ts.entry_time=(datetime)PositionGetInteger(POSITION_TIME);
      g_ts.peak_price=dir>0?SymbolInfoDouble(_Symbol,SYMBOL_BID):SymbolInfoDouble(_Symbol,SYMBOL_ASK);
      Event("POSITION_RECOVERED",dir,"position_id="+IntegerToString((long)g_ts.position_id));
      if(adopted==1) SwapTradeContexts();
      adopted++;
     }
  }

int OnInit()
  {

   // Generate unique run ID
   g_run_id = InpRunLabel + "_" + _Symbol + "_" + IntegerToString((int)TimeLocal());
   StringReplace(g_run_id, ".", "_");
   StringReplace(g_run_id, " ", "_");

   // Validate inputs
   string why;
   if(InpBaseVolume <= 0.0 || InpFixedVolume <= 0.0 || InpBalanceStep <= 0.0 || InpMaximumVolume < 0.0)
     { Alert("QUANTORA ABORT: invalid dynamic-volume inputs"); return INIT_PARAMETERS_INCORRECT; }
   double startup_volume = CalculateEntryVolume(true);
   if(startup_volume <= 0.0 || !IsVolumeValid(startup_volume, why))
     { Alert("QUANTORA ABORT: ", why); Print("QUANTORA ABORT: ", why); return INIT_PARAMETERS_INCORRECT; }
   if(InpStopPriceDistance <= 0.0 || InpConfirmSec < 1 || InpBaseLen < 120 ||
      InpEarlyTargetSec < 0 || InpEarlyTargetSec > 60)
     { Alert("QUANTORA ABORT: parametros invalidos"); return INIT_PARAMETERS_INCORRECT; }
   if(InpMFE_Level1 <= 0 || InpGiveback1 <= 0 || InpGiveback1 >= InpMFE_Level1)
     { Alert("QUANTORA ABORT: MFE Level1 o Giveback1 invalidos"); return INIT_PARAMETERS_INCORRECT; }

   // Create ATR indicator handle
   g_atr_handle = iATR(_Symbol, InpATRTF, InpATRLen);
   if(g_atr_handle == INVALID_HANDLE)
     { Alert("QUANTORA ABORT: no se pudo crear ATR handle"); return INIT_FAILED; }

   // Create CSV files
   if(!CreateFiles())
     { Alert("QUANTORA ABORT: no se pudieron crear archivos CSV"); return INIT_FAILED; }

   // Initialize state
   g_initial_balance = AccountInfoDouble(ACCOUNT_BALANCE);
   g_peak_equity = g_initial_balance;
   bool history_ready=BuildHistoryState(InpArmLockReplayBars);
   if(!history_ready) SeedSeries();
   else { g_series_ready=true; g_first_usable=TimeCurrent(); }
   g_last_work_bar=iTime(_Symbol,InpWorkTF,0);
   g_closed_snapshot_pending=true;
   ZeroMemory(g_ts); ZeroMemory(g_ts2);
   
   RecoverState(); // Attach to our own open position if it exists, ignore other EAs

   // Safety reconciliation: whatever the approximate replay concluded, if
   // we KNOW (from the broker, not from replay) that a position is open,
   // that side must be locked and not armed - override with certainty.
   if(g_ts.active)
     { if(g_ts.dir>0){g_buy_locked=true;g_buy_armed=false;g_sell_locked=false;g_sell_armed=true;} else {g_sell_locked=true;g_sell_armed=false;g_buy_locked=false;g_buy_armed=true;} }
   if(g_ts2.active)
     { if(g_ts2.dir>0){g_buy_locked=true;g_buy_armed=false;g_sell_locked=false;g_sell_armed=true;} else {g_sell_locked=true;g_sell_armed=false;g_buy_locked=false;g_buy_armed=true;} }


   EnsureOneSideArmed();
   DrawArmedLegend();
   Print("STOCHEXTREME EA REAL STATE: BUY armed=",BoolText(g_buy_armed)," SELL armed=",BoolText(g_sell_armed));
   Event("RUN_STARTED", 0,
         "v3.18 INDEPENDENT_ENTRY_ROBUST_EXIT INTRABAR_ARM_FIX DYNAMIC_VOLUME INDEPENDENT_OVERLAP SL=" + DoubleToString(InpStopPriceDistance, 1) +
         " dynamic_vol=" + DoubleToString(startup_volume, VolumeDigits(SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP))) +
         " MFE_giveback=" + DoubleToString(InpMFE_Level1, 0) + "/" + DoubleToString(InpGiveback1, 0) +
         "|" + DoubleToString(InpMFE_Level2, 0) + "/" + DoubleToString(InpGiveback2, 0) +
         "|" + DoubleToString(InpMFE_Level3, 0) + "/" + DoubleToString(InpGiveback3, 0));

   Print("QUANTORA RUN ID: ", g_run_id);
   Print("CSV destination: Terminal/Common/Files/Quantora_", g_run_id, "_*.csv");
   Print("StochExtreme USTEC v3.18 | Intrabar Arm Fix | Dynamic Volume | Independent Overlap | MFE-Giveback primary exit | ",
         "SL=", InpStopPriceDistance, " | MFE levels: ",
         InpMFE_Level1, "/", InpGiveback1, " | ",
         InpMFE_Level2, "/", InpGiveback2, " | ",
         InpMFE_Level3, "/", InpGiveback3);

   return INIT_SUCCEEDED;
  }

void ManageCurrentTrade(const MqlTick &q,bool did_shift)
  {
   SyncTradeState();
   ProcessLatchedTargetExit();
   CheckEarlyTargetWindow(q);
   ProcessLatchedTargetExit();
   UpdateMFEGiveback(q);
   CheckTargetFallback();
   ProcessLatchedTargetExit();
  }

void ManageBothTrades(const MqlTick &q,bool did_shift)
  {
   ManageCurrentTrade(q,did_shift);
   SwapTradeContexts();
   ManageCurrentTrade(q,did_shift);
   SwapTradeContexts();
  }

void OnTick()
  {
   MqlTick q;
   if(!SymbolInfoTick(_Symbol, q)) return;
   DrawArmedLegend();
   g_ticks_processed++;
   if(g_first_tick == 0) g_first_tick = q.time;
   g_last_tick = q.time;

   // Detect new M30 bar
   datetime bar = iTime(_Symbol, InpWorkTF, 0);
   bool new_bar = (bar != 0 && bar != g_last_work_bar);
   if(new_bar)
     { g_last_work_bar=bar; g_work_bars_seen++; g_pending_shift=true; g_closed_snapshot_pending=true; }
   if(g_closed_snapshot_pending) CaptureClosedM30Snapshot();
   UpdateLiveWorkCache(q,new_bar);

   // Recalculate stochastic K/D
   bool calc = (InpCalculationMode == Q_LIVE_INTRABAR) || g_pending_shift;
   bool did_shift = false;
   if(calc)
     {
      bool ok = RecalculateKD(InpCalculationMode == Q_M30_CLOSED, g_pending_shift, did_shift);
      if(ok)
        {
         if(!g_series_ready && g_work_bars_seen >= InpWarmupWorkBars)
           {
            g_series_ready = true;
            g_first_usable = q.time;
            Event("WARMUP_COMPLETED", 0, "strategy signals enabled");
           }
         // Early exit uses the freshly calculated live K during the final
         // configured seconds of M30. It is checked before arm/cross/entry work.
         ApplyArmAndRearm(did_shift);
         EnsureOneSideArmed();
         DrawArmedLegend();
         DetectCross();
        }
      else if(g_pending_shift)
         Event("RECALC_KD_FAILED_PENDING_SHIFT", 0,
               "bar close shift retrying next tick, g_prev_k still stale from prior bar");
     }

   // Confirmation + retry execution
   CheckConfirmation();

   // Both positions retain completely independent SL, MFE, target latch and close lifecycle.
   ManageBothTrades(q,did_shift);

   // Equity and tick audit
   WriteEquity(false);
   if(g_f_ticks != INVALID_HANDLE)
      FileWrite(g_f_ticks, g_run_id,
                TimeToString(q.time, TIME_DATE | TIME_SECONDS), q.time_msc,
                q.bid, q.ask, q.last, q.volume_real,
                g_k, g_d, g_adaptive_tf, g_k_len,
                g_ts.active ? g_ts.trade_id : (g_ts2.active ? g_ts2.trade_id : 0));
   if((g_ticks_processed % 10000) == 0) FlushAll();

   // Live chart comment
   if(InpShowLiveComment)
      Comment("QUANTORA MT5 | www.quantoramt5.com\nStochExtreme USTEC v3.18 | EA automatico\nRun: ", g_run_id,
              "\nK: ", DoubleToString(g_k, 2), " D: ", DoubleToString(g_d, 2),
              "\nTrades: ", g_closed_trades, " W/L: ", g_struct_wins, "/", g_struct_losses,
              g_ts.active ? "\nPos: " + DirText(g_ts.dir) +
                            " MFE=" + DoubleToString(g_ts.mfe_points, 1) +
                            " Lv=" + IntegerToString(g_ts.giveback_level) +
                            " SL=" + DoubleToString(g_ts.stop_price, _Digits) : "",
              g_ts2.active ? "\nPos2: " + DirText(g_ts2.dir) +
                             " MFE=" + DoubleToString(g_ts2.mfe_points,1) +
                             " Lv=" + IntegerToString(g_ts2.giveback_level) +
                             " SL=" + DoubleToString(g_ts2.stop_price,_Digits) : "");
  }

void OnDeinit(const int reason)
  {
   WriteEquity(true);
   double pf = g_gross_loss > 0.0 ? g_gross_profit / g_gross_loss : 0.0;
   string warning = AnyTradeActive() ? "ended_with_open_independent_trade" : "none";
   if(g_f_manifest != INVALID_HANDLE)
      FileWrite(g_f_manifest, g_run_id, "COMPLETED", "3.18", _Symbol,
                CalcModeText(), ExecModeText(),
                TimeToString(g_first_tick, TIME_DATE | TIME_SECONDS),
                TimeToString(g_last_tick, TIME_DATE | TIME_SECONDS),
                g_ticks_processed, g_closed_trades, g_struct_wins, g_struct_losses,
                g_net_profit, pf, g_max_dd_abs, g_max_dd_pct, warning);
   if(g_f_coverage != INVALID_HANDLE)
      FileWrite(g_f_coverage, g_run_id, _Symbol,
                TimeToString(g_first_tick, TIME_DATE | TIME_SECONDS),
                TimeToString(g_last_tick, TIME_DATE | TIME_SECONDS),
                TimeToString(g_first_usable, TIME_DATE | TIME_SECONDS),
                g_ticks_processed, g_work_bars_seen, BoolText(g_series_ready));
   Event("RUN_FINISHED", 0, warning);
   FlushAll();
   CloseFiles();
   if(g_atr_handle != INVALID_HANDLE) IndicatorRelease(g_atr_handle);
   ObjectDelete(0,ArmedLegendName());
   Comment("");
  }
//+------------------------------------------------------------------+
