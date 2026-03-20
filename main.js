const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const video = document.getElementById("video");
const timeline = document.getElementById("timeline");

let files = [];
let clips = [];
let selected = null;

const pxPerSec = 80;

// FFmpeg
let ffmpeg, loaded=false;
async function initFFmpeg(){
  if(loaded) return;
  ffmpeg = FFmpeg.createFFmpeg({
    log:true,
    corePath:"https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"
  });
  await ffmpeg.load();
  loaded=true;
}

// ファイル読み込み
fileInput.onchange = () => {
  for(const file of fileInput.files){
    files.push(file);
    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.textContent = file.name;

    div.onclick = ()=>{
      video.src = url;
      video.dataset.index = files.indexOf(file);
    };

    fileList.appendChild(div);
  }
};

// タイムライン追加
document.getElementById("addBtn").onclick = () => {
  const i = video.dataset.index;
  if(i === undefined) return;

  const file = files[i];

  const clip = {
    file,
    start:0,
    end:video.duration || 5,
    track: file.type.startsWith("audio") ? 1 : 0,
    x:0
  };

  clips.push(clip);
  render();
};

// 描画
function render(){
  timeline.innerHTML="";

  // 目盛り
  for(let i=0;i<100;i++){
    const mark = document.createElement("div");
    mark.style.position="absolute";
    mark.style.left = (i*pxPerSec)+"px";
    mark.style.width="1px";
    mark.style.height="100%";
    mark.style.background="#555";
    timeline.appendChild(mark);
  }

  clips.forEach((clip,i)=>{
    const div = document.createElement("div");
    div.className="clip";

    if(clip.track===1) div.classList.add("audio");
    if(clip===selected) div.classList.add("selected");

    const width = (clip.end-clip.start)*pxPerSec;

    div.style.left = clip.x+"px";
    div.style.top = clip.track===0 ? "10px" : "60px";
    div.style.width = width+"px";

    // 選択
    div.onclick = (e)=>{
      e.stopPropagation();
      selected = clip;
      render();
    };

    // ドラッグ
    div.onmousedown = (e)=>{
      const startX = e.clientX;
      const origX = clip.x;

      const move = (e2)=>{
        clip.x = origX + (e2.clientX-startX);
        render();
      };

      const up=()=>{
        document.removeEventListener("mousemove",move);
        document.removeEventListener("mouseup",up);
      };

      document.addEventListener("mousemove",move);
      document.addEventListener("mouseup",up);
    };

    timeline.appendChild(div);
  });
}

// スクラブ
timeline.onclick = (e)=>{
  const rect = timeline.getBoundingClientRect();
  const x = e.clientX - rect.left;
  video.currentTime = x / pxPerSec;
};

// 分割
document.getElementById("splitBtn").onclick = ()=>{
  if(!selected) return;

  const t = video.currentTime;

  if(t<=selected.start || t>=selected.end) return;

  const c1 = {...selected, end:t};
  const c2 = {...selected, start:t, x:selected.x + (t-selected.start)*pxPerSec};

  const i = clips.indexOf(selected);
  clips.splice(i,1,c1,c2);

  selected=c2;
  render();
};

// 書き出し（結合）
document.getElementById("exportBtn").onclick = async ()=>{
  if(clips.length===0) return;

  await initFFmpeg();

  let list="";

  for(let i=0;i<clips.length;i++){
    const c = clips[i];
    const iname="in"+i+".mp4";
    const oname="c"+i+".mp4";

    ffmpeg.FS("writeFile",iname,await FFmpeg.fetchFile(c.file));

    await ffmpeg.run(
      "-i",iname,
      "-ss",String(c.start),
      "-to",String(c.end),
      "-c","copy",
      oname
    );

    list+=`file ${oname}\n`;
  }

  ffmpeg.FS("writeFile","list.txt",list);

  await ffmpeg.run(
    "-f","concat",
    "-safe","0",
    "-i","list.txt",
    "-c","copy",
    "out.mp4"
  );

  const data = ffmpeg.FS("readFile","out.mp4");

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data.buffer],{type:"video/mp4"}));
  a.download="video.mp4";
  a.click();
};