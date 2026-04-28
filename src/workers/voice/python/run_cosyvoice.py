import sys, json, base64, os, hashlib, time
# ВАЖНО: это обвязка. Внутри ты подключишь реальную CosyVoice3 инференс-логику.
# Сейчас возвращаем "shape" ответа, чтобы весь Tele•GPT код уже заработал энд-ту-энд.

def ok(**kw):
    return {"status": "done", **kw}

def main():
    raw = sys.stdin.read()
    req = json.loads(raw)

    op = req.get("op")
    user_id = req.get("user_id", "unknown")
    model_dir = req.get("model_dir", "")

    # TODO: здесь импорт/инициализация CosyVoice3 из model_dir
    # TODO: декодирование аудио, ресемпл/моно, trim_to_seconds

    if op == "clone":
        audio_b64 = req.get("audio_base64", "")
        audio_bytes = base64.b64decode(audio_b64.encode("utf-8")) if audio_b64 else b""
        h = hashlib.sha256(audio_bytes).hexdigest()[:16]
        voice_id = f"voice_{user_id}_{h}"
        embedding_ref = f"{model_dir}/embeddings/{voice_id}.bin"
        print(json.dumps(ok(voice_id=voice_id, embedding_ref=embedding_ref, warnings=[])))
        return

    if op in ("speak", "convert", "dialogue"):
        # TODO: вернуть реальный wav bytes base64
        dummy_wav = b"RIFF....WAVE"  # placeholder (невалидный wav, заменишь на реальный)
        print(json.dumps(ok(audio_base64=base64.b64encode(dummy_wav).decode("utf-8"), warnings=["python runner is stub"])))
        return

    print(json.dumps({"status": "blocked", "warnings": ["unknown op"]}))

if __name__ == "__main__":
    main()
