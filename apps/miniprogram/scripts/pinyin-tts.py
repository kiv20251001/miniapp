"""
给 build-pinyin-audio.mjs 调用：python pinyin-tts.py plan.json out.bin model_dir [--voice N]
挑音色时：python pinyin-tts.py plan.json - model_dir --probe 3,10,20（需要 pip install librosa）

每个音节合成「X1。X2。X4。X1 X5。」和「X1。X3。」两句，按模型输出的音素时长切出五段：四个声调和轻声。
输出：'UPY1' + u32 文件头长度 + JSON 文件头 + MP3 数据。文件头 items 里是 "ma1": [偏移, 长度]，偏移从数据开头算。
"""
import json
import struct
import sys

import numpy as np
import onnxruntime as ort

SR = 24000
# 比较过 3、8、15、22、30、40、50 号中文音色，22 号的四个声调最分明
VOICE = 22
SPEED = 0.78


def load_tokens(model_dir):
    table = {}
    with open(f"{model_dir}/tokens.txt", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            token, value = line.rsplit(" ", 1)
            table[token if token else " "] = int(value)
    return table


class Kokoro:
    def __init__(self, model_dir):
        self.tokens = load_tokens(model_dir)
        self.voices = np.fromfile(f"{model_dir}/voices.bin", dtype=np.float32).reshape(-1, 510, 256)
        options = ort.SessionOptions()
        options.intra_op_num_threads = 4
        self.session = ort.InferenceSession(f"{model_dir}/model.int8.onnx", options)

    def run(self, seq, voice):
        ids = [0] + [self.tokens[item] for item in seq] + [0]
        style = self.voices[voice, min(len(seq), 509)].reshape(1, 256)
        audio, dur = self.session.run(None, {
            "tokens": np.array([ids], dtype=np.int64),
            "style": style,
            "speed": np.array([SPEED], dtype=np.float32),
        })
        hop = len(audio) / max(1, int(dur.sum()))
        edges = np.concatenate([[0], np.cumsum(dur)]) * hop
        return audio.astype(np.float32), edges


def sentences(phones):
    """
    返回 [(token 序列, {声调: (起始 token, 声调 token)})]，下标已算上开头的填充位。
    三声单独放在短句「X1。X3。」的末尾，才会读出「降下去再扬起来」的完整三声；放在长句里只降不升。
    """
    out = []
    for plan in ([(1, True, True), (2, True, True), (4, True, True), (1, False, False), (5, True, True)], [(1, False, True), (3, True, True)]):
        seq, found = [], {}
        for tone, keep, stop in plan:
            start = len(seq) + 1
            seq.extend(phones + [str(tone)] + (["."] if stop else []))
            if keep:
                found[tone] = (start, start + len(phones))
        out.append((seq, found))
    return out


def clips_of(kokoro, phones, voice):
    """一个音节的五段声音，按一、二、三、四声、轻声排好。"""
    found = {}
    for seq, spans in sentences(phones):
        audio, edges = kokoro.run(seq, voice)
        tones = list(spans)
        for tone, clip in zip(tones, cut(audio, edges, [spans[t] for t in tones])):
            found[tone] = clip
    return [found[tone] for tone in (1, 2, 3, 4, 5)]


def trim(clip):
    frame = int(SR * 0.01)
    energy = np.array([np.sqrt(np.mean(clip[i:i + frame] ** 2)) for i in range(0, max(1, len(clip) - frame), frame)])
    if not len(energy) or energy.max() <= 0:
        return clip
    loud = np.where(energy > energy.max() * 0.05)[0]
    head = max(0, (loud[0] - 2) * frame)
    tail = min(len(clip), (loud[-1] + 6) * frame)
    return clip[head:tail]


def finish(clip):
    clip = trim(clip).copy()
    fade_in, fade_out = int(SR * 0.008), int(SR * 0.03)
    if len(clip) > fade_in + fade_out:
        clip[:fade_in] *= np.linspace(0, 1, fade_in)
        clip[-fade_out:] *= np.linspace(1, 0, fade_out)
    rms = np.sqrt(np.mean(clip ** 2)) or 1
    clip *= min(0.12 / rms, 0.93 / (np.abs(clip).max() or 1))
    pad = np.zeros(int(SR * 0.02), dtype=np.float32)
    return np.concatenate([pad, clip, pad])


def cut(audio, edges, spans):
    clips = []
    for start, tone in spans:
        a = edges[start] - SR * 0.05
        b = edges[tone + 1] + min(edges[tone + 2] - edges[tone + 1], SR * 0.08)
        clips.append(finish(audio[int(max(0, a)):int(b)]))
    return clips


def mp3(clip):
    import lameenc
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(32)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(1)
    encoder.set_quality(2)
    pcm = (np.clip(clip, -1, 1) * 32767).astype("<i2").tobytes()
    return bytes(encoder.encode(pcm) + encoder.flush())


def tone_of(clip):
    """粗分声调：只在挑音色时用来比较哪个音色声调最准。"""
    import librosa
    f0, _, _ = librosa.pyin(clip, fmin=110, fmax=500, sr=SR, frame_length=1024, hop_length=240)
    f0 = f0[~np.isnan(f0)]
    if len(f0) < 6:
        return 0
    st = 12 * np.log2(f0 / np.median(f0))
    n = len(st)
    head, mid, end = np.median(st[: n // 4 + 1]), np.median(st[n // 3: 2 * n // 3 + 1]), np.median(st[-(n // 4 + 1):])
    low = st.min()
    lowest = int(np.argmin(st)) / n
    if head - end > 3:
        return 4
    if end - head > 2.5 and lowest < 0.45:
        return 2
    if 0.2 < lowest < 0.8 and min(head, end) - low > 1.5:
        return 3
    if max(head, mid, end) - min(head, mid, end) < 2:
        return 1
    return 0


def probe(plan, model_dir, voices):
    kokoro = Kokoro(model_dir)
    sample = plan[:: max(1, len(plan) // 40)]
    for voice in voices:
        right = total = 0
        for item in sample:
            for tone, clip in enumerate(clips_of(kokoro, item["phones"], voice)[:4], start=1):
                total += 1
                right += tone_of(clip) == tone
        print(f"voice {voice}: {right}/{total}", flush=True)


def build(plan, out, model_dir, voice):
    kokoro = Kokoro(model_dir)
    items, chunks, offset = {}, [], 0
    for index, item in enumerate(plan):
        for tone, clip in zip((1, 2, 3, 4, 5), clips_of(kokoro, item["phones"], voice)):
            data = mp3(clip)
            items[f"{item['syllable']}{tone}"] = [offset, len(data)]
            chunks.append(data)
            offset += len(data)
        if index % 40 == 0:
            print(f"{index}/{len(plan)} {item['syllable']}", flush=True)
    header = json.dumps({"v": 1, "sr": SR, "voice": voice, "items": items}, separators=(",", ":")).encode("ascii")
    with open(out, "wb") as f:
        f.write(b"UPY1")
        f.write(struct.pack("<I", len(header)))
        f.write(header)
        for chunk in chunks:
            f.write(chunk)
    print(f"{len(items)} clips, {(8 + len(header) + offset) / 1024:.0f} KB")


def main():
    args = sys.argv[1:]
    plan_file, out, model_dir = args[:3]
    with open(plan_file, encoding="utf-8") as f:
        plan = json.load(f)
    if "--probe" in args:
        probe(plan, model_dir, [int(v) for v in args[args.index("--probe") + 1].split(",")])
        return
    voice = int(args[args.index("--voice") + 1]) if "--voice" in args else VOICE
    build(plan, out, model_dir, voice)


if __name__ == "__main__":
    main()
