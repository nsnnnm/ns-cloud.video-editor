// DOM
const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const fileList = document.getElementById("fileList");
const timeline = document.getElementById("timeline");

// 状態
let clips = [];
let currentFile = null;
let ffmpeg = null;
let ffmpegLoaded = false;

// FFmpeg 初期化
async function initFFmpeg() {
  if (ffmpegLoaded) return;

  ffmpeg = FFmpeg.createFFmpeg({
    log: true,
    corePath: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js"
  });

  await ffmpeg.load();
  ffmpegLoaded = true;
  console.log("FFmpeg loaded");
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
  div.onclick = () => video.src = url;
  fileList.appendChild(div);

  addClip();
};

// タイムラインに追加
function addClip() {
  const clip = {
    x: 10,
    width: 200
  };
  clips.push(clip);
  renderTimeline();
}

// タイムライン描画
function renderTimeline() {
  timeline.innerHTML = "";

  clips.forEach((clip, i) => {
    const div = document.createElement("div");
    div.className = "clip";
    div.style.left = clip.x + "px";
    div.style.width = clip.width + "px";

    // ドラッグ
    div.onmousedown = (e) => {
      const startX = e.clientX;

      const onMove = (e2) => {
        const dx = e2.clientX - startX;
        clip.x += dx;
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

// カット処理
document.getElementById("cutBtn").onclick = async () => {
  if (!currentFile) {
    alert("動画を選択して");
    return;
  }

  await initFFmpeg();

  ffmpeg.FS("writeFile", "input.mp4", await FFmpeg.fetchFile(currentFile));

  await ffmpeg.run(
    "-i", "input.mp4",
    "-ss", "0",
    "-t", "5",
    "-c", "copy",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");

  video.src = URL.createObjectURL(
    new Blob([data.buffer], { type: "video/mp4" })
  );
};

// 書き出し
document.getElementById("exportBtn").onclick = () => {
  if (!video.src) return;

  const a = document.createElement("a");
  a.href = video.src;
  a.download = "export.mp4";
  a.click();
};