from __future__ import annotations

import torch
import torch.nn as nn


class TrajectoryGRUAutoEncoder(nn.Module):
    """轻量 GRU 自编码器：正常轨迹低重构误差，异常轨迹高误差。"""

    def __init__(self, seq_len: int, input_dim: int = 2, hidden: int = 64, latent: int = 16) -> None:
        super().__init__()
        self.seq_len = seq_len
        self.encoder = nn.GRU(input_dim, hidden, batch_first=True, num_layers=1)
        self.enc_fc = nn.Linear(hidden, latent)
        self.dec_fc = nn.Linear(latent, hidden)
        self.decoder = nn.GRU(hidden, hidden, batch_first=True, num_layers=1)
        self.out = nn.Linear(hidden, input_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B, T, D]
        h, _ = self.encoder(x)
        last = h[:, -1, :]
        z = torch.relu(self.enc_fc(last))
        h0 = torch.relu(self.dec_fc(z)).unsqueeze(1).expand(-1, self.seq_len, -1)
        dec_h, _ = self.decoder(h0)
        return self.out(dec_h)
