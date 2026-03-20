const fileInput = document.getElementById("fileInput");
const video = document.getElementById("video");
const fileList = document.getElementById("fileList");
const timeline = document.getElementById("timeline");

let clips = [];
let currentFile = null;

// FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

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

      document.onmousemove = (e2) => {
        const dx = e2.clientX - startX;
        clip.x += dx;
        renderTimeline();
      };

      document.onmouseup = () => {
        document.onmousemove = null;
      };
    };

    timeline.appendChild(div);
  });
}

// カット
document.getElementById("cutBtn").onclick = async () => {
  if (!currentFile) return;

  await ffmpeg.load();

  ffmpeg.FS("writeFile", "input.mp4", await fetchFile(currentFile));

  await ffmpeg.run(
    "-i", "input.mp4",
    "-ss", "0",
    "-t", "5",
    "-c", "copy",
    "output.mp4"
  );

  const data = ffmpeg.FS("readFile", "output.mp4");
  video.src = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
};

// 書き出し
document.getElementById("exportBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = video.src;
  a.download = "export.mp4";
  a.click();
};