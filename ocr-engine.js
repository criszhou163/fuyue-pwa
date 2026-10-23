/* Bounded local OCR passes for documents and photo-backed posters. */
(function(root){
  async function recognize(file,{language='chi_sim',kind='auto',enhance=true,cities=[],onProgress=()=>{},cancelled=()=>false,onWorker=()=>{}}={}){
    const url=URL.createObjectURL(file);const image=new Image();let worker;
    const check=()=>{if(cancelled())throw new Error('已取消识别');};
    async function readCanvas(canvas){let timeout;try{return await Promise.race([worker.recognize(canvas),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('本轮识别超时，请缩小图片后重试')),60000);})]);}finally{clearTimeout(timeout);}}
    function canvasFor(top=0,height=1,whiteText=false,maxHeight=2600){
      const sourceHeight=Math.round(image.naturalHeight*height),sourceWidth=image.naturalWidth;
      const scale=Math.min(2,2400/sourceWidth,maxHeight/sourceHeight);const canvas=document.createElement('canvas');
      canvas.width=Math.round(sourceWidth*scale)+24;canvas.height=Math.round(sourceHeight*scale)+24;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,Math.round(image.naturalHeight*top),sourceWidth,sourceHeight,12,12,canvas.width-24,canvas.height-24);
      if(whiteText){
        const pixels=ctx.getImageData(12,12,canvas.width-24,canvas.height-24),d=pixels.data;
        // Isolate light, nearly neutral lettering from saturated photo backgrounds.
        for(let i=0;i<d.length;i+=4){const min=Math.min(d[i],d[i+1],d[i+2]),max=Math.max(d[i],d[i+1],d[i+2]);const v=min>210&&max-min<40?0:255;d[i]=d[i+1]=d[i+2]=v;}
        // Strengthen hairline lettering without erasing it through hard contrast.
        const original=new Uint8ClampedArray(d),w=pixels.width,h=pixels.height;
        for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let v=255;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)v=Math.min(v,original[((y+dy)*w+x+dx)*4]);const i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=v;}
        ctx.putImageData(pixels,12,12);
      }
      return whiteText&&maxHeight===180?dominantText(canvas):canvas;
    }
    function dominantText(canvas){
      const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,w,h).data,ink=new Uint8Array(w*h),queue=new Int32Array(w*h),components=[];
      for(let i=0;i<ink.length;i++)ink[i]=pixels[i*4]<128?1:0;
      for(let start=0;start<ink.length;start++){if(!ink[start])continue;let read=0,write=1,minX=w,maxX=0,minY=h,maxY=0;queue[0]=start;ink[start]=0;
        while(read<write){const n=queue[read++],x=n%w,y=Math.floor(n/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);for(const next of [x>0?n-1:-1,x<w-1?n+1:-1,y>0?n-w:-1,y<h-1?n+w:-1])if(next>=0&&ink[next]){ink[next]=0;queue[write++]=next;}}
        if(write>=10&&maxX-minX>1&&maxX-minX<w*.7)components.push({minX,maxX,minY,maxY,height:maxY-minY});
      }
      const height=Math.max(0,...components.map(c=>c.height));const large=components.filter(c=>c.height>=height*.65);if(large.length<2)return canvas;
      const x=Math.min(...large.map(c=>c.minX)),right=Math.max(...large.map(c=>c.maxX)),y=Math.min(...large.map(c=>c.minY)),bottom=Math.max(...large.map(c=>c.maxY));
      // Mixed-size dates and prices have different baselines; read the dominant line separately.
      const out=document.createElement('canvas');out.width=right-x+33;out.height=bottom-y+33;const target=out.getContext('2d');target.fillStyle='#fff';target.fillRect(0,0,out.width,out.height);target.drawImage(canvas,x,Math.max(0,y-4),right-x+1,Math.min(h-y+4,bottom-y+9),16,12,right-x+1,Math.min(h-y+4,bottom-y+9));canvas.width=canvas.height=1;return out;
    }
    function lightTextBands(){
      const probe=document.createElement('canvas');const scale=Math.min(1,1000/image.naturalWidth);probe.width=Math.round(image.naturalWidth*scale);probe.height=Math.round(image.naturalHeight*scale);
      const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,probe.width,probe.height);const {data}=ctx.getImageData(0,0,probe.width,probe.height),bands=[];
      for(let y=0;y<probe.height;y++){let count=0;for(let x=0;x<probe.width;x++){const i=(y*probe.width+x)*4,min=Math.min(data[i],data[i+1],data[i+2]),max=Math.max(data[i],data[i+1],data[i+2]);if(min>225&&max-min<25)count++;}
        if(count>probe.width*.008&&count<probe.width*.5){const last=bands[bands.length-1];if(last&&y-last.end<Math.max(4,8*scale))last.end=y;else bands.push({start:y,end:y});}}
      const found=bands.filter(b=>b.end-b.start>Math.max(7,12*scale)&&b.end-b.start<probe.height*.28).slice(-6).map(b=>({top:Math.max(0,b.start-6)/probe.height,height:(Math.min(probe.height,b.end+7)-Math.max(0,b.start-6))/probe.height,name:'浅色文字行',white:true,english:true,psm:'7',maxHeight:180}));probe.width=probe.height=1;return found;
    }
    try{
      image.src=url;await image.decode();check();await loadTesseract();check();
      let phase='加载识别模型';onProgress(phase);
      const workerPromise=Tesseract.createWorker([language,'eng'],1,{logger:m=>{
        if(cancelled())return;
        const statuses={'loading tesseract core':'加载识别引擎','loading language traineddata':'加载语言模型','initializing api':'初始化识别引擎','recognizing text':phase};
        if(statuses[m.status])onProgress(`${statuses[m.status]}… ${Math.round((m.progress||0)*100)}%`);
      }});
      let timer;try{worker=await Promise.race([workerPromise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('模型加载超时，请检查网络后重试')),90000);})]);}
      catch(error){workerPromise.then(w=>w.terminate()).catch(()=>{});throw error;}finally{clearTimeout(timer);}
      onWorker(worker);check();
      const posterPasses=()=>[
        {top:0,height:1,name:'整图分散文字',psm:'11'},
        {top:.55,height:.45,name:enhance?'下半部浅色文字':'下半部文字',white:enhance,psm:'11'},
        {top:.77,height:.23,name:'底部日期与场馆',psm:'11'},...(enhance?lightTextBands():[])
      ];
      const passes=kind==='poster'?posterPasses():[{top:0,height:1,name:'购票页面正文',psm:'3'}];
      let detectedKind=kind;
      const outputs=[];
      for(let i=0;i<passes.length;i++){
        check();const pass=passes[i];phase=i===0&&kind==='auto'?'识别页面类型与正文':`第 ${i+1}/${passes.length} 步：${pass.name}`;onProgress(phase);
        if(pass.english&&!passes[i-1]?.english)await worker.reinitialize('eng',1);
        await worker.setParameters({tessedit_pageseg_mode:pass.psm,preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_char_whitelist:''});
        const canvas=canvasFor(pass.top,pass.height,pass.white,pass.maxHeight);
        try{const result=await readCanvas(canvas);outputs.push({text:result.data.text,confidence:result.data.confidence,pass:pass.name,fields:pass.fields,band:!!pass.english,region:{top:pass.top,height:pass.height}});
          if(i===0&&kind!=='poster'){
            detectedKind=kind==='order'||/订单|票档|支付|下单|退票规则|立即购买|入场保障|选座购买/.test(result.data.text)?'order':'poster';
            if(detectedKind==='order')passes.push({top:0,height:.5,name:'上半部场次补读',psm:'11',fields:['dates']});
            else {outputs.length=0;passes.push(...posterPasses());}
          }
          if(pass.english&&/\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i.test(result.data.text)&&/\d/.test(result.data.text)){
            phase='补读英文日期行';onProgress(phase);await worker.setParameters({tessedit_pageseg_mode:'13',tessedit_char_whitelist:'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ,.&-:'});
            const dateResult=await readCanvas(canvas);outputs.push({text:dateResult.data.text,confidence:dateResult.data.confidence,pass:'英文日期原始行'});
          }
        }
        finally{canvas.width=canvas.height=1;}
      }
      check();
      // This merged text is only for inspection/manual correction. Automatic
      // extraction uses the separate passes, retaining contradictory evidence.
      const seen=new Set(),lines=[];for(const output of outputs)for(const line of output.text.split(/\r?\n/)){const clean=FuyueOCR.tidy(line);if(clean&&!seen.has(clean)){seen.add(clean);lines.push(clean);}}
      return {text:lines.join('\n'),passes:outputs,kind:detectedKind,warnings:[]};
    }finally{URL.revokeObjectURL(url);if(worker)await worker.terminate().catch(()=>{});onWorker(null);}
  }
  root.FuyueImageOCR={recognize};
})(window);
