import base64
import os
import uuid
from pathlib import Path
from typing import Dict, List, Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from faster_whisper import WhisperModel
import torch
import torchaudio

import sys
sys.path.append(str(Path(__file__).parent / "CosyVoice" / "third_party" / "Matcha-TTS"))

from cosyvoice.cli.cosyvoice import AutoModel

DATA = Path(os.getenv("TELEGPT_VOICE_DATA", "./.telegpt/voice")).resolve()
VOICES = DATA / "voices"
OUT = DATA / "out"
VOICES.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

MODEL_DIR = os.getenv("COSYVOICE_MODEL_DIR", "pretrained_models/Fun-CosyVoice3-0.5B-2512")

app = FastAPI(title="TeleGPT Local Voice Provider (CosyVoice3)")

cosy = AutoModel(model_dir=MODEL_DIR)
SAMPLE_RATE = getattr(cosy, "sample_rate", 16000)
ASR_MODEL_NAME = os.getenv("TELEGPT_ASR_MODEL", "small")
ASR_DEVICE = "cuda" if os.getenv("CUDA_VISIBLE_DEVICES", "") != "" else "cpu"
ASR_COMPUTE = "float16" if ASR_DEVICE == "cuda" else "int8"
asr = WhisperModel(ASR_MODEL_NAME, device=ASR_DEVICE, compute_type=ASR_COMPUTE)


def load_prompt_wav(path: Path, target_sr: int = 16000):
    wav, sr = torchaudio.load(str(path))
    if sr != target_sr:
        wav = torchaudio.functional.resample(wav, sr, target_sr)
    if wav.shape[0] > 1:
        wav = wav.mean(dim=0, keepdim=True)
    return wav


def write_b64_audio_to_wav(b64: str, dst: Path) -> Path:
    raw = base64.b64decode(b64.encode("utf-8"))
    dst.write_bytes(raw)
    return dst


def transcribe_wav(path: Path, lang_hint: str = "ru") -> str:
    language = None if lang_hint in ("auto", "", None) else lang_hint
    segments, _info = asr.transcribe(
        str(path), language=language, vad_filter=True
    )
    text = " ".join([s.text.strip() for s in segments]).strip()
    return text


class SpeakReq(BaseModel):
    voice_id: str
    text: str
    prompt_text: str = "Ты — полезный ассистент.<|endofprompt|>"
    lang_hint: str = "ru"


class ConvertReq(BaseModel):
    target_voice_id: str
    source_audio_base64: str
    source_mime: str = "audio/wav"
    prompt_text: str = "Ты — полезный ассистент.<|endofprompt|>"
    lang_hint: str = "ru"


class DialogueLine(BaseModel):
    speaker: Literal["A", "B"]
    text: str


class DialogueReq(BaseModel):
    script: List[DialogueLine]
    voices: Dict[str, Dict[str, str]]
    prompt_text_A: str = "Ты — спикер A.<|endofprompt|>"
    prompt_text_B: str = "Ты — спикер B.<|endofprompt|>"
    lang_hint: str = "ru"


@app.get("/health")
def health():
    return {"ok": True, "model_dir": MODEL_DIR}


@app.post("/voice/register")
async def register_voice(ref: UploadFile = File(...)):
    voice_id = str(uuid.uuid4())
    dst = VOICES / f"{voice_id}.wav"
    raw = await ref.read()
    dst.write_bytes(raw)
    return {"voice_id": voice_id}


@app.post("/tts")
def tts(req: SpeakReq):
    ref = VOICES / f"{req.voice_id}.wav"
    if not ref.exists():
        raise HTTPException(404, "voice_id not found")

    prompt_wav = load_prompt_wav(ref, target_sr=16000)

    chunks = []
    for out in cosy.inference_zero_shot(
        req.text, req.prompt_text, prompt_wav, stream=False
    ):
        chunks.append(out["tts_speech"])

    if not chunks:
        raise HTTPException(500, "no audio produced")

    audio = torch.cat(chunks, dim=1) if len(chunks) > 1 else chunks[0]

    out_id = str(uuid.uuid4())
    out_path = OUT / f"{out_id}.wav"
    torchaudio.save(str(out_path), audio.cpu(), SAMPLE_RATE)

    return {"status": "done", "wav_path": str(out_path), "sample_rate": SAMPLE_RATE}


@app.post("/convert")
def convert(req: ConvertReq):
    ref = VOICES / f"{req.target_voice_id}.wav"
    if not ref.exists():
        raise HTTPException(404, "target_voice_id not found")

    tmp_id = str(uuid.uuid4())
    src_path = OUT / f"src_{tmp_id}.wav"
    write_b64_audio_to_wav(req.source_audio_base64, src_path)

    prompt_wav = load_prompt_wav(ref, target_sr=16000)

    audio = None
    warnings = []

    if hasattr(cosy, "inference_vc"):
        src_wav, sr = torchaudio.load(str(src_path))
        if sr != 16000:
            src_wav = torchaudio.functional.resample(src_wav, sr, 16000)
        if src_wav.shape[0] > 1:
            src_wav = src_wav.mean(dim=0, keepdim=True)

        chunks = []
        for out in cosy.inference_vc(src_wav, prompt_wav, stream=False):
            chunks.append(out.get("tts_speech") or out.get("vc_speech"))
        if chunks:
            audio = chunks[-1]
        else:
            warnings.append("inference_vc returned no chunks")
    else:
        warnings.append("inference_vc not available; using fallback ASR->TTS")

        recognized = transcribe_wav(src_path, lang_hint=req.lang_hint)
        if not recognized:
            raise HTTPException(500, "ASR produced empty text")

        chunks = []
        for out in cosy.inference_zero_shot(
            recognized, req.prompt_text, prompt_wav, stream=False
        ):
            chunks.append(out["tts_speech"])
        if not chunks:
            raise HTTPException(500, "TTS produced no audio in fallback")

        audio = chunks[-1]

    out_id = str(uuid.uuid4())
    out_path = OUT / f"vc_{out_id}.wav"
    torchaudio.save(str(out_path), audio.cpu(), SAMPLE_RATE)

    return {
        "status": "done",
        "wav_path": str(out_path),
        "sample_rate": SAMPLE_RATE,
        "warnings": warnings,
    }


@app.post("/dialogue")
def dialogue(req: DialogueReq):
    a_id = req.voices.get("A", {}).get("voice_id")
    b_id = req.voices.get("B", {}).get("voice_id")
    if not a_id or not b_id:
        raise HTTPException(400, "voices.A.voice_id and voices.B.voice_id required")

    refA = VOICES / f"{a_id}.wav"
    refB = VOICES / f"{b_id}.wav"
    if not refA.exists() or not refB.exists():
        raise HTTPException(404, "one or both voice_id not found")

    promptA = load_prompt_wav(refA, target_sr=16000)
    promptB = load_prompt_wav(refB, target_sr=16000)

    pieces = []
    for line in req.script:
        if not line.text.strip():
            continue
        if line.speaker == "A":
            gen = cosy.inference_zero_shot(
                line.text, req.prompt_text_A, promptA, stream=False
            )
        else:
            gen = cosy.inference_zero_shot(
                line.text, req.prompt_text_B, promptB, stream=False
            )

        last = None
        for out in gen:
            last = out["tts_speech"]
        if last is not None:
            pieces.append(last)

    if not pieces:
        raise HTTPException(500, "no audio produced")

    audio = torch.cat(pieces, dim=1) if len(pieces) > 1 else pieces[0]

    out_id = str(uuid.uuid4())
    out_path = OUT / f"dlg_{out_id}.wav"
    torchaudio.save(str(out_path), audio.cpu(), SAMPLE_RATE)

    return {"status": "done", "wav_path": str(out_path), "sample_rate": SAMPLE_RATE}
