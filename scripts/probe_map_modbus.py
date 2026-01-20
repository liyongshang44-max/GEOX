from pymodbus.client import ModbusSerialClient

PORT="COM4"
BAUD=9600
PARITY="N"
STOPBITS=1
DEVICE_ID=1

def read_holding(client, addr, count):
    rr = client.read_holding_registers(addr, count=count, device_id=DEVICE_ID)
    if rr and not rr.isError():
        return rr.registers
    return None

def read_input(client, addr, count):
    rr = client.read_input_registers(addr, count=count, device_id=DEVICE_ID)
    if rr and not rr.isError():
        return rr.registers
    return None

def main():
    client = ModbusSerialClient(
        port=PORT, baudrate=BAUD, parity=PARITY, stopbits=STOPBITS,
        bytesize=8, timeout=1
    )
    if not client.connect():
        print("connect failed")
        return

    # 扫这些区间：低地址(常见实时) + 80/100(你已有非0常量) + 扩展区(很多设备把EC放后面)
    ranges = [
        (0, 40),     # 0..39
        (80, 40),    # 80..119
        (120, 40),   # 120..159
        (160, 40),   # 160..199
        (200, 60),   # 200..259
    ]

    for base, span in ranges:
        print(f"\n== addr {base:04d}..{base+span-1:04d} ==")
        for a in range(base, base+span, 10):
            h = read_holding(client, a, 10)
            i = read_input(client, a, 10)

            if h:
                print(f"H {a:04d}: {h}")
            else:
                print(f"H {a:04d}: <no>")

            if i:
                print(f"I {a:04d}: {i}")
            else:
                print(f"I {a:04d}: <no>")

    client.close()

if __name__ == "__main__":
    main()