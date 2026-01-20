# dump_modbus_input.py
# Read Modbus INPUT registers in blocks, to find real-time values (EC often here)

from pymodbus.client import ModbusSerialClient
import time

PORT = "COM4"
BAUD = 9600
PARITY = "N"
STOPBITS = 1
DEVICE_ID = 1

def main():
    client = ModbusSerialClient(
        port=PORT,
        baudrate=BAUD,
        parity=PARITY,
        stopbits=STOPBITS,
        bytesize=8,
        timeout=1
    )

    if not client.connect():
        print("Failed to connect serial")
        return

    for base in range(0, 201, 20):
        try:
            rr = client.read_input_registers(
                base,
                count=20,
                device_id=DEVICE_ID
            )
            if rr and not rr.isError():
                regs = rr.registers
            else:
                regs = None
        except Exception as e:
            regs = None

        if regs:
            print(f"addr {base:04d}: {regs}")
        else:
            print(f"addr {base:04d}: <no response>")

        time.sleep(0.1)

    client.close()

if __name__ == "__main__":
    main()