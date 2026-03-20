const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const fileList = document.getElementById("fileList");
const timeline = document.getElementById("timeline");

let clips = [];
let selectedClip = null;
let currentFile = null;

const pxPerSec = 50;

// FFmpeg
let ffmpeg = null;
let loaded = false;

async function initFFmpeg() {
  if (loaded) return;

  ffmpeg = FFmpeg.createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/ffmpeg-core.js"
  });

  await ffmpeg.load();
  loaded = true;
}

// ファイル読み込み
fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;

  currentFile = file;
  const url = URL.createObjectURL(file);
  video.src = url;

  const div = document.createElement("div");
  div.textContent = file.name;
  fileList.appendChild(div);

  // クリップ追加（動画全体）
  const clip = {
    start: 0,
    end: video.duration || 10
  };

  video.onloadedmetadata = () => {
    clip.end = video.duration;
    clips = [clip];
    renderTimeline();
  };
};

// タイムライン描画
function renderTimeline() {
  timeline.innerHTML = "";

  clips.forEach((clip, i) => {
    const div = document.createElement("div");
    div.className = "clip";

    if (clip === selectedClip) {
      div.classList.add("selected");
    }

    div.style.left = clip.start * pxPerSec + "px";
    div.style.width = (clip.end - clip.start) * pxPerSec + "px";

    // 選択
    div.onclick = (e) => {
      e.stopPropagation();
      selectedClip = clip;
      renderTimeline();
    };

    // ドラッグ移動
    div.onmousedown = (e) => {
      const startX = e.clientX;
      const originalStart = clip.start;

      const onMove = (e2) => {
        const dx = (e2.clientX - startX) / pxPerSec;
        clip.start = Math.max(0, originalStart + dx);
        clip.end = clip.start + (clip.end - clip.start);
        renderTimeline();
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    timeline.appendChild(div);
  });
}

// 分割
document.getElementById("splitBtn").onclick = () => {
  if (!selectedClip) return;

  const time = video.currentTime;

  if (time <= selectedClip.start || time >= selectedClip.end) return;

  const clip1 = {
    start: selectedClip.start,
    end: time
  };

  const clip2 = {
    start: time,
    end: selectedClip.end
  };

  const index = clips.indexOf(selectedClip);
  clips.splice(index, 1, clip1, clip2);

  selectedClip = clip2;

  renderTimeline();
};

// タイムラインクリックで再生移動
timeline.onclick = (e) => {
  const rect = timeline.getBoundingClientRect();
  const x = e.clientX - rect.left;
  video.currentTime = x / pxPerSec;
};

// カット（選択クリップ）
document.getElementById("cutBtn").onclick = async () => {
  if (!currentFile || !selectedClip) return;

  await initFFmpeg();

  ffmpeg.FS("writeFile", "input.mp4", await FFmpeg.fetchFile(currentFile));

  await ffmpeg.run(
    "-i", "input.mp4",
    "-ss", String(selectedClip.start),
    "-to", String(selectedClip.end),
    "-c", "copy",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");

  video.src = URL.createObjectURL(
    new Blob([data.buffer], { type: "video/mp4" })
  );
};

// 書き出し（現在動画）
document.getElementById("exportBtn").onclick = () => {
  if (!video.src) return;

  const a = document.createElement("a");
  a.href = video.src;
  a.download = "export.mp4";
  a.click();
};