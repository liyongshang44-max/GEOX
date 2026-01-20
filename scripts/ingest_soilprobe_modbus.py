# GEOX/scripts/ingest_soilprobe_modbus.py
# Read soil probe via Modbus RTU and ingest into GEOX backend (/api/raw).
# - Reads holding registers addr 0..1 (count=2) from device_id (default 1).
# - Maps:
#   reg0 -> moisture (%) = reg0 / 10
#   reg1 -> soil_temp_c  = int16(reg1) / 10   (supports negative)
#
# Requires: pymodbus>=3, pyserial, requests
#
# Example:
#   (.venv) PS> python .\scripts\ingest_soilprobe_modbus.py --port COM4 --base http://127.0.0.1:3000 --sensor-id S1
#
# Stop: Ctrl+C

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from typing import Optional, Tuple

import requests
from pymodbus.client import ModbusSerialClient


@dataclass
class Config:
    port: str
    baud: int
    parity: str
    stopbits: int
    bytesize: int
    device_id: int
    base: str
    sensor_id: str
    interval_sec: float
    timeout_sec: float
    retries: int
    reg_addr: int
    reg_count: int
    source: str
    quality: str
    dry_run: bool


def log(msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def int16_from_u16(x: int) -> int:
    # Convert 0..65535 to signed int16
    x = int(x) & 0xFFFF
    return x - 0x10000 if x & 0x8000 else x


def post_raw(base: str, payload: dict, timeout_sec: float) -> None:
    url = base.rstrip("/") + "/api/raw"
    r = requests.post(url, json=payload, timeout=timeout_sec)
    if r.status_code < 200 or r.status_code >= 300:
        raise RuntimeError(f"POST {url} status={r.status_code} body={r.text[:300]}")


def read_regs(client: ModbusSerialClient, cfg: Config) -> Optional[Tuple[int, int]]:
    """
    Returns (reg0, reg1) if successful else None.
    """
    # pymodbus 3.x uses device_id kwarg (not unit/slave)
    rr = client.read_holding_registers(cfg.reg_addr, count=cfg.reg_count, device_id=cfg.device_id)
    if rr is None:
        return None
    if rr.isError():
        return None
    regs = getattr(rr, "registers", None)
    if not regs or len(regs) < 2:
        return None
    return int(regs[0]), int(regs[1])


def build_payload(ts_ms: int, sensor_id: str, metric: str, value: float, cfg: Config) -> dict:
    return {
        "ts": ts_ms,
        "sensorId": sensor_id,
        "metric": metric,
        "value": float(value),
        "quality": cfg.quality,
        "source": cfg.source,
    }


def make_client(cfg: Config) -> ModbusSerialClient:
    # Pymodbus expects parity in {"N","E","O"}, stopbits int, bytesize int
    return ModbusSerialClient(
        port=cfg.port,
        baudrate=cfg.baud,
        parity=cfg.parity,
        stopbits=cfg.stopbits,
        bytesize=cfg.bytesize,
        timeout=cfg.timeout_sec,
        retries=cfg.retries,
    )


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest soil probe Modbus RTU -> GEOX /api/raw")
    p.add_argument("--port", default="COM4", help="Serial port, e.g. COM4")
    p.add_argument("--baud", type=int, default=9600, help="Baud rate (default 9600)")
    p.add_argument("--parity", default="N", choices=["N", "E", "O"], help="Parity (default N)")
    p.add_argument("--stopbits", type=int, default=1, choices=[1, 2], help="Stop bits (default 1)")
    p.add_argument("--bytesize", type=int, default=8, choices=[7, 8], help="Data bits (default 8)")
    p.add_argument("--device-id", type=int, default=1, help="Modbus device_id (default 1)")
    p.add_argument("--base", default="http://127.0.0.1:3000", help="Backend base URL")
    p.add_argument("--sensor-id", default="S1", help="sensorId used in GEOX ingest")
    p.add_argument("--interval", type=float, default=30.0, help="Polling interval seconds (default 30)")
    p.add_argument("--timeout", type=float, default=1.0, help="Serial request timeout seconds (default 1.0)")
    p.add_argument("--retries", type=int, default=1, help="Serial retries per request (default 1)")
    p.add_argument("--reg-addr", type=int, default=0, help="Start register address (default 0)")
    p.add_argument("--reg-count", type=int, default=2, help="Register count (default 2)")
    p.add_argument("--source", default="device", choices=["device", "gateway", "system"], help="source field")
    p.add_argument("--quality", default="ok", choices=["unknown", "ok", "suspect", "bad"], help="quality field")
    p.add_argument("--dry-run", action="store_true", help="Do not POST; only print values")

    args = p.parse_args()

    cfg = Config(
        port=args.port,
        baud=args.baud,
        parity=args.parity,
        stopbits=args.stopbits,
        bytesize=args.bytesize,
        device_id=args.device_id,
        base=args.base,
        sensor_id=args.sensor_id,
        interval_sec=max(1.0, float(args.interval)),
        timeout_sec=max(0.2, float(args.timeout)),
        retries=max(0, int(args.retries)),
        reg_addr=int(args.reg_addr),
        reg_count=int(args.reg_count),
        source=args.source,
        quality=args.quality,
        dry_run=bool(args.dry_run),
    )

    log("ingest_soilprobe_modbus starting")
    log(f"serial={cfg.port} {cfg.baud} parity={cfg.parity} stopbits={cfg.stopbits} bytesize={cfg.bytesize} device_id={cfg.device_id}")
    log(f"backend={cfg.base} sensorId={cfg.sensor_id} interval={cfg.interval_sec}s dry_run={cfg.dry_run}")

    client = make_client(cfg)

    backoff = 1.0
    max_backoff = 10.0

    try:
        while True:
            # Ensure connected
            if not client.connected:
                log("connecting serial client ...")
                ok = client.connect()
                if not ok:
                    log(f"connect failed. retry in {backoff:.1f}s")
                    time.sleep(backoff)
                    backoff = min(max_backoff, backoff * 1.5)
                    continue
                log("connected")
                backoff = 1.0

            ts_ms = int(time.time() * 1000)

            regs = read_regs(client, cfg)
            if regs is None:
                log("read failed (no response / modbus error). will reconnect")
                try:
                    client.close()
                except Exception:
                    pass
                time.sleep(0.3)
                continue

            reg0, reg1 = regs

            moisture = reg0 / 10.0
            soil_temp_c = int16_from_u16(reg1) / 10.0

            if cfg.dry_run:
                log(f"READ reg0={reg0} reg1={reg1} -> moisture={moisture:.1f} soil_temp_c={soil_temp_c:.1f}")
            else:
                try:
                    post_raw(cfg.base, build_payload(ts_ms, cfg.sensor_id, "moisture", moisture, cfg), timeout_sec=5.0)
                    post_raw(cfg.base, build_payload(ts_ms, cfg.sensor_id, "soil_temp_c", soil_temp_c, cfg), timeout_sec=5.0)
                    log(f"INGEST ok: moisture={moisture:.1f} soil_temp_c={soil_temp_c:.1f}")
                except Exception as e:
                    log(f"INGEST failed: {e}. (will keep running)")
                    # Do not stop; next loop will try again

            time.sleep(cfg.interval_sec)

    except KeyboardInterrupt:
        log("stopped by user (Ctrl+C)")
        try:
            client.close()
        except Exception:
            pass
        return 0


if __name__ == "__main__":
    raise SystemExit(main())