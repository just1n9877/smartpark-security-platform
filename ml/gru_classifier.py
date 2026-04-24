from __future__ import annotations

import torch
import torch.nn as nn


class TrajectoryGRUClassifier(nn.Module):
    """共享编码：GRU 取末态 → 线性分类（身份/反馈类别）。"""

    def __init__(self, seq_len: int, num_classes: int, input_dim: int = 2, hidden: int = 64) -> None:
        super().__init__()
        self.seq_len = seq_len
        self.encoder = nn.GRU(input_dim, hidden, batch_first=True, num_layers=1)
        self.fc = nn.Linear(hidden, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, h = self.encoder(x)
        return self.fc(h[-1])
