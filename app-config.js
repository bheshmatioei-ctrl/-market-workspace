window.MARKET_WORKSPACE_CONFIG={google:{clientId:"",scope:"https://www.googleapis.com/auth/drive.appdata"}};

(function(){
  const TV_BASE='https://s3.tradingview.com/external-embedding/';
  const symbols={AMZN:'NASDAQ:AMZN',NVDA:'NASDAQ:NVDA',INTC:'NASDAQ:INTC',AAPL:'NASDAQ:AAPL',MSFT:'NASDAQ:MSFT'};
  let mounted={};

  function scriptWidget(host,src,config){
    if(!host) return;
    host.innerHTML='';
    const wrap=document.createElement('div');
    wrap.className='tradingview-widget-container';
    wrap.style.width='100%';wrap.style.height='100%';
    const inner=document.createElement('div');
    inner.className='tradingview-widget-container__widget';
    inner.style.width='100%';inner.style.height='100%';
    wrap.appendChild(inner);
    const s=document.createElement('script');
    s.type='text/javascript';s.async=true;s.src=TV_BASE+src;
    s.textContent=JSON.stringify(config);
    wrap.appendChild(s);host.appendChild(wrap);
  }

  function currentTicker(){
    try{const x=JSON.parse(localStorage.getItem('mw-v5'));return x&&x.active?x.active:'AMZN'}catch{return 'AMZN'}
  }

  function mountMarket(){
    const host=document.querySelector('.w[data-id="market"] .body');
    if(!host) return;
    const ticker=currentTicker();
    const key='market:'+ticker+':'+host.clientWidth+'x'+host.clientHeight;
    if(mounted.market===key && host.querySelector('.tradingview-widget-container')) return;
    mounted.market=key;
    host.style.padding='0';host.style.overflow='hidden';
    scriptWidget(host,'embed-widget-advanced-chart.js',{
      autosize:true,symbol:symbols[ticker]||('NASDAQ:'+ticker),interval:'D',timezone:'Europe/Berlin',theme:'light',style:'1',locale:'en',allow_symbol_change:true,calendar:false,support_host:'https://www.tradingview.com'
    });
  }

  function mountCalendar(){
    const host=document.querySelector('.w[data-id="cal"] .body');
    if(!host) return;
    const key='cal:'+host.clientWidth+'x'+host.clientHeight;
    if(mounted.cal===key && host.querySelector('.tradingview-widget-container')) return;
    mounted.cal=key;host.style.padding='0';host.style.overflow='hidden';
    scriptWidget(host,'embed-widget-events.js',{
      colorTheme:'light',isTransparent:true,width:'100%',height:'100%',locale:'en',importanceFilter:'0,1',countryFilter:'us,de,eu'
    });
  }

  function mountNews(){
    const host=document.querySelector('.w[data-id="news"] .body');
    if(!host) return;
    const ticker=currentTicker();
    const key='news:'+ticker+':'+host.clientWidth+'x'+host.clientHeight;
    if(mounted.news===key && host.querySelector('.tradingview-widget-container')) return;
    mounted.news=key;host.style.padding='0';host.style.overflow='hidden';
    scriptWidget(host,'embed-widget-timeline.js',{
      feedMode:'symbol',symbol:symbols[ticker]||('NASDAQ:'+ticker),isTransparent:true,displayMode:'regular',width:'100%',height:'100%',colorTheme:'light',locale:'en'
    });
  }

  function enhanceWatchlist(){
    document.querySelectorAll('[data-t]').forEach(btn=>{
      if(btn.dataset.liveBound) return;
      btn.dataset.liveBound='1';
      btn.addEventListener('click',()=>setTimeout(()=>{mounted.market='';mounted.news='';mountAll()},30));
    });
  }

  function addStatus(){
    const brand=document.querySelector('.brand');
    if(!brand||document.getElementById('liveStatus')) return;
    const b=document.createElement('span');
    b.id='liveStatus';b.textContent=' • LIVE';b.style.color='#0a8f4d';b.style.fontWeight='800';b.style.fontSize='12px';
    brand.appendChild(b);
  }

  function mountAll(){
    addStatus();enhanceWatchlist();mountMarket();mountCalendar();mountNews();
  }

  let timer;
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(mountAll,80)});
  function start(){
    const ws=document.getElementById('ws');
    if(ws) observer.observe(ws,{childList:true,subtree:true});
    mountAll();
    setInterval(()=>{mounted.cal='';mountCalendar()},15*60*1000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
