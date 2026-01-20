import time
import requests
from pymodbus.client import ModbusSerialClient

# ======= 配置区（按你的图）=======
COM_PORT = "COM4"
BAUDRATE = 9600
PARITY = "N"
STOPBITS = 1
BYTESIZE = 8
SLAVE_ID = 1

# 你的后端
BASE = "http://127.0.0.1:3000"

# 你现在系统里默认组是 G_DEFAULT，成员 S1/S2
# 为了“立刻在现有前端看到”，建议直接写入 S1
SENSOR_ID = "S1"

# 寄存器映射（按你图里 00000/00001 有值）
# 先读 3 个：00000,00001,00002（00020 不用）
REG_START = 0
REG_COUNT = 3

# 采样周期（ms）
INTERVAL_MS = 1000

# 缩放与符号：
# 你说单位无错，但不确定是否有负温 —— 我按“有负温”处理：
# 温度寄存器按 int16；再 /10
def to_int16(u16: int) -> int:
    return u16 - 65536 if u16 >= 32768 else u16

def post_raw(ts_ms: int, metric: str, value: float):
    url = f"{BASE}/api/raw"
    payload = {
        "ts": ts_ms,
        "sensorId": SENSOR_ID,
        "metric": metric,
        "value": float(value),
        "quality": "ok",
        "source": "device",
    }
    r = requests.post(url, json=payload, timeout=5)
    r.raise_for_status()

def main():
    client = ModbusSerialClient(
        port=COM_PORT,
        baudrate=BAUDRATE,
        parity=PARITY,
        stopbits=STOPBITS,
        bytesize=BYTESIZE,
        timeout=1,
    )

    if not client.connect():
        raise RuntimeError(f"Cannot open serial port {COM_PORT}. Is Modbus Poll still using it?")

    print("[OK] Connected:", COM_PORT)

    while True:
        ts = int(time.time() * 1000)

        rr = client.read_holding_registers(REG_START, REG_COUNT, slave=SLAVE_ID)
        if rr.isError():
            print("[WARN] read error:", rr)
            time.sleep(INTERVAL_MS / 1000.0)
            continue

        regs = rr.registers  # list of u16
        # 约定：
        # 00000 -> moisture_x10  (例如 697 -> 69.7)
        # 00001 -> soil_temp_x10 (例如 232 -> 23.2；支持负温)
        # 00002 -> ec_x10 或 ec_x100（你若确定单位，可调整）
        moisture = regs[0] / 10.0
        soil_temp = to_int16(regs[1]) / 10.0
        ec = regs[2] / 10.0

        try:
            post_raw(ts, "moisture", moisture)
            post_raw(ts, "soil_temp", soil_temp)
            post_raw(ts, "ec", ec)
            print(f"[OK] ts={ts} moisture={moisture} soil_temp={soil_temp} ec={ec}")
        except Exception as e:
            print("[WARN] post failed:", e)

        time.sleep(INTERVAL_MS / 1000.0)

if __name__ == "__main__":
    main()