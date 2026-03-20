// ===== import =====
import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.6/+esm";

// ===== fetchFileの代替 =====
async function fetchFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}

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
const ffmpeg = new FFmpeg();
let loaded = false;

async function initFFmpeg() {
  if (loaded) return;

  await ffmpeg.load({
    coreURL: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"
  });

  loaded = true;
  console.log("FFmpeg loaded");
}

// ===== ファイル読み込み =====
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const id = Date.now();
  const url = URL.createObjectURL(file);

  files.push({ id, file, url });

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
  div.click();
};

// ===== タイムライン追加 =====
document.getElementById("addBtn").onclick = () => {
  const id = Number(video.dataset.id);
  if (!id) return;

  const fileObj = files.find(f => f.id === id);

  const clip = {
    file: fileObj.file,
    start: 0,
    end: video.duration || 5,
    x: clips.length * 120
  };

  clips.push(clip);
  render();
};

// ===== 描画 =====
function render() {
  timeline.innerHTML = "";

  clips.forEach((clip) => {
    const div = document.createElement("div");
    div.className = "clip";

    if (clip === selected) div.classList.add("selected");

    const width = Math.max(20, (clip.end - clip.start) * pxPerSec);

    div.style.left = clip.x + "px";
    div.style.width = width + "px";

    div.onclick = (e) => {
      e.stopPropagation();
      selected = clip;
      render();
    };

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

// ===== スクラブ =====
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

// ===== 書き出し =====
document.getElementById("exportBtn").onclick = async () => {
  if (clips.length === 0) return;

  await initFFmpeg();

  const sorted = [...clips].sort((a, b) => a.x - b.x);

  let list = "";

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];

    const iname = "input" + i + ".mp4";
    const oname = "clip" + i + ".mp4";

    await ffmpeg.writeFile(iname, await fetchFile(c.file));

    await ffmpeg.exec([
      "-i", iname,
      "-ss", String(c.start),
      "-to", String(c.end),
      "-c", "copy",
      oname
    ]);

    list += `file ${oname}\n`;
  }

  await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));

  await ffmpeg.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", "list.txt",
    "-c", "copy",
    "output.mp4"
  ]);

  const data = await ffmpeg.readFile("output.mp4");

  const url = URL.createObjectURL(
    new Blob([data.buffer], { type: "video/mp4" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = "video.mp4";
  a.click();
};