mergeInto(LibraryManager.library, {
  AzarashiFlushStorage:function(){
    if(Module.azarashiSyncing){Module.azarashiSyncAgain=true;return;}
    var sync=function(){Module.azarashiSyncing=true;FS.syncfs(false,function(error){Module.azarashiSyncing=false;if(error){console.error(error);Module.SendMessage('NativeMatch','StorageError','');}if(Module.azarashiSyncAgain){Module.azarashiSyncAgain=false;sync();}});};sync();
  },
  AzarashiPixelRatio:function(){return Module.canvas.width/Math.max(1,Module.canvas.getBoundingClientRect().width);},
  AzarashiInit: function(pointer,length) {
    var bytes=HEAPU8.slice(pointer,pointer+length);
    WebAssembly.compile(bytes).then(function(module){
      Module.azarashiModule=module;
      return WebAssembly.instantiate(module,{env:{clock_now:function(){return performance.now();},search_progress:function(){}}});
    }).then(function(instance){Module.azarashiEngine=instance.exports;Module.SendMessage('NativeEngine','EngineReady','');}).catch(function(error){Module.SendMessage('NativeEngine','EngineError',String(error));});
  },
  AzarashiInspect: function(requestPointer) {
    var engine=Module.azarashiEngine,bytes=new TextEncoder().encode(UTF8ToString(requestPointer)),p=engine.engine_alloc(bytes.length)>>>0;
    try {
      new Uint8Array(engine.memory.buffer,p,bytes.length).set(bytes);
      var packed=engine.engine_inspect(p,bytes.length),out=Number(packed>>32n)>>>0,len=Number(packed&0xffffffffn);
      try { return stringToNewUTF8(new TextDecoder().decode(new Uint8Array(engine.memory.buffer,out,len))); }
      finally {engine.engine_free(out,len);}
    } finally {engine.engine_free(p,bytes.length);}
  },
  AzarashiSearch: function(requestPointer,revision) {
    if(Module.azarashiWorker)Module.azarashiWorker.terminate();
    var source="onmessage=async function(event){try{const {module,request,revision}=event.data;const instance=await WebAssembly.instantiate(module,{env:{clock_now:()=>performance.now(),search_progress:()=>{}}});const e=instance.exports;const bytes=new TextEncoder().encode(request);const p=e.engine_alloc(bytes.length)>>>0;new Uint8Array(e.memory.buffer,p,bytes.length).set(bytes);try{const result=e.engine_search(p,bytes.length);const out=Number(result>>32n)>>>0,len=Number(result&0xffffffffn);try{const parsed=JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer,out,len)));postMessage({...parsed,revision});}finally{e.engine_free(out,len);}}finally{e.engine_free(p,bytes.length);}}catch(error){postMessage({error:String(error),revision:event.data.revision});}}";
    var url=URL.createObjectURL(new Blob([source],{type:'application/javascript'})),worker=new Worker(url);URL.revokeObjectURL(url);Module.azarashiWorker=worker;
    worker.onmessage=function(event){if(Module.azarashiWorker!==worker)return;Module.SendMessage('NativeEngine','AiCompleted',JSON.stringify(event.data));worker.terminate();Module.azarashiWorker=null;};
    worker.postMessage({module:Module.azarashiModule,request:UTF8ToString(requestPointer),revision:revision});
  },
  AzarashiCancel: function(){if(Module.azarashiWorker){Module.azarashiWorker.terminate();Module.azarashiWorker=null;}},
  AzarashiDownload: function(namePointer,textPointer){var text=UTF8ToString(textPointer),name=UTF8ToString(namePointer),url=URL.createObjectURL(new Blob([text],{type:name.endsWith('.json')?'application/json':'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);},
  AzarashiChooseReplay: function(){var input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=function(){if(input.files[0])input.files[0].text().then(function(text){Module.SendMessage('NativeMatch','ImportReplay',text);});};input.click();}
});
