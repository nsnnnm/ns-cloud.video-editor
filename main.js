const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const fileList = document.getElementById("fileList");
const timeline = document.getElementById("timeline");

let files = [];
let clips = [];
let selectedClip = null;

const pxPerSec = 60;

// FFmpeg
let ffmpeg;
let loaded = false;

async function initFFmpeg() {
  if (loaded) return;

  ffmpeg = FFmpeg.createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"
  });

  await ffmpeg.load();
  loaded = true;
}

// ✅ ファイル読み込み（修正済み）
fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;

  files.push(file);
  const index = files.length - 1;
  const url = URL.createObjectURL(file);

  const div = document.createElement("div");
  div.textContent = file.name;

  div.onclick = () => {
    video.src = url;
    video.dataset.index = index;
  };

  fileList.appendChild(div);

  // 👇ここ重要（metadata待つ）
  video.src = url;
  video.dataset.index = index;

  video.onloadedmetadata = () => {
    renderTimeline(); // ←これが超重要
  };
};

// タイムライン追加
document.getElementById("addBtn").onclick = () => {
  const index = video.dataset.index;
  if (index === undefined) return;

  const file = files[index];

  // duration確実に取る
  const duration = video.duration || 5;

  const clip = {
    file,
    start: 0,
    end: duration
  };

  clips.push(clip);

  renderTimeline();
};

// タイムライン描画（強化）
function renderTimeline() {
  timeline.innerHTML = "";

  let currentX = 0;

  clips.forEach((clip) => {
    const div = document.createElement("div");
    div.className = "clip";

    if (clip === selectedClip) div.classList.add("selected");

    const duration = clip.end - clip.start;
    const width = Math.max(10, duration * pxPerSec); // ←0防止

    div.style.left = currentX + "px";
    div.style.width = width + "px";

    div.onclick = (e) => {
      e.stopPropagation();
      selectedClip = clip;
      renderTimeline();
    };

    currentX += width;
    timeline.appendChild(div);
  });
}

// 分割
document.getElementById("splitBtn").onclick = () => {
  if (!selectedClip) return;

  const time = video.currentTime;

  if (time <= selectedClip.start || time >= selectedClip.end) return;

  const c1 = { ...selectedClip, end: time };
  const c2 = { ...selectedClip, start: time };

  const i = clips.indexOf(selectedClip);
  clips.splice(i, 1, c1, c2);

  selectedClip = c2;
  renderTimeline();
};

// 書き出し
document.getElementById("exportBtn").onclick = async () => {
  if (clips.length === 0) return;

  await initFFmpeg();

  let list = "";

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const name = "input" + i + ".mp4";
    const out = "clip" + i + ".mp4";

    ffmpeg.FS("writeFile", name, await FFmpeg.fetchFile(clip.file));

    await ffmpeg.run(
      "-i", name,
      "-ss", String(clip.start),
      "-to", String(clip.end),
      "-c", "copy",
      out
    );

    list += `file ${out}\n`;
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