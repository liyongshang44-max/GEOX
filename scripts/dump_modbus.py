import time
from pymodbus.client import ModbusSerialClient

PORT = "COM4"
DEVICE_ID = 1

def to_int16(u16: int) -> int:
    # 允许负温：把 0..65535 转成 -32768..32767
    return u16 - 65536 if u16 >= 32768 else u16

def main():
    client = ModbusSerialClient(
        port=PORT,
        baudrate=9600,
        parity="N",
        stopbits=1,
        bytesize=8,
        timeout=1.0,
    )
    if not client.connect():
        print("cannot open port")
        return

    # 你刚刚 addr=0 能读到，我们从 0 开始分段读
    # 一次读 20 个，打印 0..199（你可以按需要扩到 0..399）
    for base in range(0, 200, 20):
        rr = client.read_holding_registers(base, count=20, device_id=DEVICE_ID)
        if rr is None or rr.isError():
            print(f"addr {base:04d}: <no/err>")
            continue
        regs = rr.registers
        print(f"addr {base:04d}: {regs}")

    client.close()

if __name__ == "__main__":
    main()