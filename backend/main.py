import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/recognize")
async def recognize(file: UploadFile):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="请上传图片文件（PNG 或 JPG）")

    with tempfile.TemporaryDirectory() as tmpdir:
        suffix = Path(file.filename or "input.png").suffix or ".png"
        img_path = Path(tmpdir) / f"input{suffix}"
        img_path.write_bytes(await file.read())

        try:
            result = subprocess.run(
                ["oemer", str(img_path)],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=422,
                detail="oemer 识别超时（>120s），请尝试更小的图片",
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="oemer 未安装，请在 backend/ 目录运行 uv sync",
            )

        if result.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f"oemer 识别失败：{result.stderr.strip() or '未知错误'}",
            )

        xml_files = list(Path(tmpdir).glob("*.musicxml"))
        if not xml_files:
            raise HTTPException(
                status_code=422,
                detail="oemer 未生成 MusicXML 输出，请确认图片是清晰的印刷体五线谱",
            )

        return {"musicxml": xml_files[0].read_text(encoding="utf-8")}
