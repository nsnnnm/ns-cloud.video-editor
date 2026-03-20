// ===== DOM =====
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const video = document.getElementById("video");
const timeline = document.getElementById("timeline");

// ===== 状態 =====
let files = [];
let clips = [];
let selected = null;

const pxPerSec = 80;

// ===== FFmpeg =====
const createFFmpeg = FFmpeg.createFFmpeg;
const fetchFile = FFmpeg.fetchFile;

let ffmpeg = null;
let loaded = false;

async function initFFmpeg() {
  if (loaded) return;

  ffmpeg = createFFmpeg({
    log: true,
    corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"
  });

  await ffmpeg.load();
  loaded = true;
  console.log("FFmpeg loaded");
}

// ===== ファイル読み込み =====
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const id = Date.now();
  const url = URL.createObjectURL(file);

  const item = { id, file, url };
  files.push(item);

  const div = document.createElement("div");
  div.textContent = file.name;

  div.onclick = async () => {
    video.src = url;

    await new Promise(res => {
      video.onloadedmetadata = res;
    });

    video.dataset.id = id;
  };

  fileList.appendChild(div);

  // 自動選択
  div.click();
};

// ===== タイムライン追加 =====
document.getElementById("addBtn").onclick = () => {
  const id = Number(video.dataset.id);
  if (!id) return;

  const fileObj = files.find(f => f.id === id);
  if (!fileObj) return;

  const clip = {
    file: fileObj.file,
    start: 0,
    end: video.duration || 5,
    x: clips.length * 120
  };

  clips.push(clip);
  render();
};

// ===== タイムライン描画 =====
function render() {
  timeline.innerHTML = "";

  clips.forEach((clip) => {
    const div = document.createElement("div");
    div.className = "clip";

    if (clip === selected) div.classList.add("selected");

    const duration = clip.end - clip.start;
    const width = Math.max(20, duration * pxPerSec);

    div.style.left = clip.x + "px";
    div.style.width = width + "px";

    // 選択
    div.onclick = (e) => {
      e.stopPropagation();
      selected = clip;
      render();
    };

    // ドラッグ移動
    div.onmousedown = (e) => {
      const startX = e.clientX;
      const origX = clip.x;

      const move = (e2) => {
        clip.x = origX + (e2.clientX - startX);
        render();
      };

      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };

      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };

    timeline.appendChild(div);
  });
}

// ===== タイムラインクリックで再生位置移動 =====
timeline.onclick = (e) => {
  const rect = timeline.getBoundingClientRect();
  const x = e.clientX - rect.left;
  video.currentTime = x / pxPerSec;
};

// ===== 分割 =====
document.getElementById("splitBtn").onclick = () => {
  if (!selected) return;

  const t = video.currentTime;

  if (t <= selected.start || t >= selected.end) return;

  const c1 = { ...selected, end: t };
  const c2 = {
    ...selected,
    start: t,
    x: selected.x + (t - selected.start) * pxPerSec
  };

  const i = clips.indexOf(selected);
  clips.splice(i, 1, c1, c2);

  selected = c2;
  render();
};

// ===== 書き出し（完全安定版） =====
document.getElementById("exportBtn").onclick = async () => {
  if (clips.length === 0) {
    alert("クリップがない");
    return;
  }

  await initFFmpeg();

  // 左から順に並び替え
  const sorted = [...clips].sort((a, b) => a.x - b.x);

  let list = "";

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];

    const iname = "input" + i + ".mp4";
    const oname = "clip" + i + ".mp4";

    ffmpeg.FS("writeFile", iname, await fetchFile(c.file));

    await ffmpeg.run(
      "-i", iname,
      "-ss", String(c.start),
      "-to", String(c.end),
      "-c", "copy",
      oname
    );

    list += `file ${oname}\n`;
  }

  ffmpeg.FS("writeFile", "list.txt", list);

  await ffmpeg.run(
    "-f", "concat",
    "-safe", "0",
    "-i", "list.txt",
    "-c", "copy",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");

  const url = URL.createObjectURL(
    new Blob([data.buffer], { type: "video/mp4" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = "video.mp4";
  a.click();
};