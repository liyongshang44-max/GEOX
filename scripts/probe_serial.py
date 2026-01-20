import time
import serial

PORT = "COM4"      # 你的端口
BAUD = 9600        # 先用 9600，后面不对再换 4800/19200
TIMEOUT = 1.0

def main():
    print("probe_serial:", PORT, "baud", BAUD)
    ser = serial.Serial(PORT, BAUD, timeout=TIMEOUT)
    ser.reset_input_buffer()
    ser.reset_output_buffer()

    t_end = time.time() + 3
    buf = b""
    while time.time() < t_end:
        chunk = ser.read(256)
        if chunk:
            buf += chunk
        time.sleep(0.05)

    if buf:
        print("RX bytes:", len(buf))
        print("HEAD:", buf[:200])
        print("\n=> 有主动上报/文本/噪声。下一步我们要判断协议格式。")
    else:
        print("No spontaneous data.")
        print("=> 更像请求-响应（Modbus RTU 常见）。下一步做 Modbus 扫描。")

if __name__ == "__main__":
    main()