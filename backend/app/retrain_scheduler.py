"""定时重训：后台线程每分钟检查 retrain_interval_hours。"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.model_training import enqueue_training_run
from app.system_config_service import get_or_create_system_config


def spawn_retrain_scheduler() -> None:
    def loop() -> None:
        while True:
            time.sleep(60)
            db = SessionLocal()
            try:
                row = get_or_create_system_config(db)
                hrs = int(row.retrain_interval_hours or 0)
                if hrs <= 0:
                    continue
                now = datetime.now(timezone.utc)
                last = row.last_scheduled_train_at
                if last:
                    if last.tzinfo is None:
                        last = last.replace(tzinfo=timezone.utc)
                    if now - last < timedelta(hours=hrs):
                        continue
                row.last_scheduled_train_at = now
                db.commit()
                enqueue_training_run("schedule")
            except Exception as e:  # noqa: BLE001
                print(f"[retrain_scheduler] skip tick: {e}")
            finally:
                db.close()

    threading.Thread(target=loop, daemon=True).start()
