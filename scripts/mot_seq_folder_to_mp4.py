"""
将 MOTChallenge 单条序列（img1 下的逐帧 jpg）合成为一段 mp4，供 video_tracker.py / video_surveillance_system.py 使用。

用法（在项目根目录执行）：
    python scripts/mot_seq_folder_to_mp4.py --seq "解压路径/MOT17-05-DPM"
    python scripts/mot_seq_folder_to_mp4.py --seq "解压路径/MOT17-05-DPM/img1" --out data/videos/mot17_05.mp4

依赖：opencv-python（已在 requirements.txt 中）。
"""

from __future__ import annotations

import argparse
import configparser
from pathlib import Path

import cv2


def _find_seq_root(path: Path) -> Path:
    """path 可为序列根目录（含 seqinfo.ini）或 img1 目录。"""
    path = path.resolve()
    if path.name == "img1" and path.is_dir():
        return path.parent
    return path


def _read_seqinfo(seq_root: Path) -> tuple[int, int, int, float, str]:
    """
    返回 (width, height, seq_length, frame_rate, im_ext)。
    若缺少 seqinfo.ini，则抛出说明性错误。
    """
    ini_path = seq_root / "seqinfo.ini"
    if not ini_path.is_file():
        raise SystemExit(
            f"未找到 seqinfo.ini: {ini_path}\n"
            "请确认 --seq 指向 MOT 解压后的单条序列文件夹（内含 img1/ 与 seqinfo.ini）。"
        )
    cfg = configparser.ConfigParser()
    cfg.read(ini_path, encoding="utf-8")
    sec = "Sequence"
    if sec not in cfg:
        raise SystemExit(f"{ini_path} 中缺少 [Sequence] 段，无法解析。")
    w = cfg.getint(sec, "imWidth")
    h = cfg.getint(sec, "imHeight")
    n = cfg.getint(sec, "seqLength")
    fps = float(cfg.get(sec, "frameRate"))
    ext = cfg.get(sec, "imExt").lstrip(".")
    return w, h, n, fps, ext


def main() -> None:
    p = argparse.ArgumentParser(description="MOT 序列 img1 -> 单文件 mp4")
    p.add_argument(
        "--seq",
        type=Path,
        required=True,
        help="MOT 单序列目录（例如 MOT17-05-DPM），或该目录下的 img1",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="输出 mp4 路径（默认：项目 data/videos/<序列名>.mp4）",
    )
    p.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="仅编码前 N 帧（0 表示全部，用于快速试跑）",
    )
    args = p.parse_args()

    seq_root = _find_seq_root(args.seq)
    w, h, n, fps, ext = _read_seqinfo(seq_root)
    im_dir = seq_root / "img1"
    if not im_dir.is_dir():
        raise SystemExit(f"未找到图像目录: {im_dir}")

    project_root = Path(__file__).resolve().parents[1]
    seq_name = seq_root.name
    out_path = args.out
    if out_path is None:
        out_path = project_root / "data" / "videos" / f"{seq_name}.mp4"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    pattern = f"*.{ext}"
    frames = sorted(im_dir.glob(pattern))
    if not frames:
        raise SystemExit(f"{im_dir} 下没有匹配 {pattern} 的帧文件。")

    if len(frames) < n:
        print(f"警告: 帧数 {len(frames)} 少于 seqinfo 中的 seqLength={n}，将使用实际帧数。")
    limit = n if len(frames) >= n else len(frames)
    if args.max_frames > 0:
        limit = min(limit, args.max_frames)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (w, h))
    if not writer.isOpened():
        raise SystemExit(f"无法创建视频文件: {out_path}")

    for i, fp in enumerate(frames[:limit]):
        im = cv2.imread(str(fp))
        if im is None:
            print(f"跳过无法读取的帧: {fp}")
            continue
        if im.shape[1] != w or im.shape[0] != h:
            im = cv2.resize(im, (w, h))
        writer.write(im)

    writer.release()
    print(f"已写入 {limit} 帧, FPS={fps}, 输出: {out_path.resolve()}")


if __name__ == "__main__":
    main()
