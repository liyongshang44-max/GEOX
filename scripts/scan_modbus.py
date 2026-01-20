import time
import inspect
import pymodbus
from pymodbus.client import ModbusSerialClient

PORT = "COM4"

CANDIDATE_SERIAL = [
    dict(baudrate=9600, parity="N", stopbits=1),
    dict(baudrate=4800, parity="N", stopbits=1),
    dict(baudrate=19200, parity="N", stopbits=1),
    dict(baudrate=38400, parity="N", stopbits=1),
    dict(baudrate=9600, parity="E", stopbits=1),
    dict(baudrate=9600, parity="O", stopbits=1),
    dict(baudrate=9600, parity="N", stopbits=2),
]

# 常见探测地址段（不同厂家的寄存器起点差异很大）
PROBE_BLOCKS = [
    ("holding", 0, 4),
    ("holding", 1, 4),
    ("holding", 100, 4),
    ("holding", 256, 4),
    ("holding", 400, 4),
    ("input",   0, 4),
    ("input",   1, 4),
    ("input",   100, 4),
    ("input",   256, 4),
    ("input",   400, 4),
]

def read_regs(client, kind: str, addr: int, count: int, device_id: int):
    if kind == "holding":
        fn = client.read_holding_registers
    else:
        fn = client.read_input_registers

    # pymodbus 3.11: count/device_id 都是关键字
    return fn(addr, count=count, device_id=device_id)

def main():
    print("scan_modbus:", PORT)
    print("pymodbus version:", getattr(pymodbus, "__version__", "unknown"))

    try:
        sig_h = inspect.signature(ModbusSerialClient.read_holding_registers)
        sig_i = inspect.signature(ModbusSerialClient.read_input_registers)
        print("sig read_holding_registers:", sig_h)
        print("sig read_input_registers:  ", sig_i)
    except Exception as e:
        print("cannot inspect signatures:", e)

    # 先快扫，再全扫
    fast_ids = list(range(1, 51))
    full_ids = list(range(1, 248))

    for s in CANDIDATE_SERIAL:
        print(f"\n== Try serial: baud={s['baudrate']} parity={s['parity']} stopbits={s['stopbits']} ==")

        client = ModbusSerialClient(
            port=PORT,
            baudrate=s["baudrate"],
            parity=s["parity"],
            stopbits=s["stopbits"],
            bytesize=8,
            timeout=0.8,
        )

        if not client.connect():
            print("!! cannot open port")
            continue

        def scan_ids(ids, label):
            print(f"-- Scan {label}: device_id {ids[0]}..{ids[-1]} --")
            for did in ids:
                for kind, addr, count in PROBE_BLOCKS:
                    try:
                        rr = read_regs(client, kind, addr, count, did)
                    except Exception:
                        continue

                    if rr is None:
                        continue
                    if hasattr(rr, "isError") and rr.isError():
                        continue

                    regs = getattr(rr, "registers", None)
                    if regs is not None and len(regs) > 0:
                        print("\nFOUND:")
                        print(f"  device_id = {did}")
                        print(f"  kind      = {kind}")
                        print(f"  addr      = {addr}")
                        print(f"  regs      = {regs}")
                        return True

                    time.sleep(0.01)
            return False

        if scan_ids(fast_ids, "FAST") or scan_ids(full_ids, "FULL"):
            client.close()
            return

        client.close()

    print("\nNo Modbus response found.")
    print("下一步建议（按优先级）：")
    print("1) 确认这是 RS485/Modbus RTU（不是 USB 直连/私有串口协议）")
    print("2) 确认 A/B 线序（反了会完全无响应）")
    print("3) 确认设备供电与 GND 参考（部分适配器/设备需要共地）")
    print("4) 询问设备说明书：默认 baud/parity/stopbits + 站号 + 寄存器表")

if __name__ == "__main__":
    main()