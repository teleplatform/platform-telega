import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
import torchaudio

# CosyVoice3 basic usage pattern:
# from cosyvoice.cli.cosyvoice import AutoModel
# cosyvoice = AutoModel(model_dir="pretrained_models/Fun-CosyVoice3-0.5B")
# cosyvoice.inference_zero_shot(tts_text, prompt_text, prompt_wav, stream=False)
from cosyvoice.cli.cosyvoice import AutoModel

DATA = Path(os.getenv("TELEGPT_VOICE_DATA", "./voice_data")).resolve()
DATA.mkdir(parents=True, exist_ok=True)
VOICES = DATA / "voices"
VOICES.mkdir(parents=True, exist_ok=True)

MODEL_DIR = os.getenv("COSYVOICE_MODEL_DIR", "pretrained_models/Fun-CosyVoice3-0.5B")

app = FastAPI(title="TeleGPT Local Voice Provider (CosyVoice3)")

cosyvoice = AutoModel(model_dir=MODEL_DIR)
SAMPLE_RATE = getattr(cosyvoice, "sample_rate", 16000)


class TTSReq(BaseModel):
    voice_id: str
    text: str
    prompt_text: str = "You are a helpful assistant.<|endofprompt|>"


@app.get("/health")
def health():
    return {"ok": True, "model_dir": MODEL_DIR}


@app.post("/voice/register")
async def register_voice(ref: UploadFile = File(...)):
    voice_id = str(uuid.uuid4())
    out = VOICES / f"{voice_id}.wav"
    raw = await ref.read()
    out.write_bytes(raw)
    return {"voice_id": voice_id}


@app.post("/tts")
def tts(req: TTSReq):
    wav_path = VOICES / f"{req.voice_id}.wav"
    if not wav_path.exists():
        raise HTTPException(404, "voice_id not found")

    prompt_wav, sr = torchaudio.load(str(wav_path))
    if sr != 16000:
        prompt_wav = torchaudio.functional.resample(prompt_wav, sr, 16000)
    if prompt_wav.shape[0] > 1:
        prompt_wav = prompt_wav.mean(dim=0, keepdim=True)

    out_wavs = []
    for chunk in cosyvoice.inference_zero_shot(
        req.text, req.prompt_text, prompt_wav, stream=False
    ):
        out_wavs.append(chunk["tts_speech"])

    if not out_wavs:
        raise HTTPException(500, "no audio produced")

    audio = out_wavs[-1]
    out_id = str(uuid.uuid4())
    out_file = DATA / f"tts_{out_id}.wav"
    torchaudio.save(str(out_file), audio.cpu(), SAMPLE_RATE)
    return {"file": str(out_file), "sample_rate": SAMPLE_RATE}
