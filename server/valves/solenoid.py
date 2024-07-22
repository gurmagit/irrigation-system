import network, socket, time, re, ujson
from machine import Pin

SSID = 'GUR_HOT'
PASSWORD = 'zoeyahli'
valves = {
    "valve1": 15,
    "valve2": 2,
    "valve3": 4,
    "valve4": 16
}
for v in valves.keys():
    Pin(valves[v], Pin.OUT, 0)

def connect_to_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(SSID, PASSWORD)
    while not wlan.isconnected():
        print('Connecting to network...')
        time.sleep(1)
    print('Network connected:', wlan.ifconfig())

def handle_request(request):
    param = re.search('GET[ /0-9a-z]+HTTP', request)
    if param:
        finds = param.group(0).split('/')
        valve = finds[1]
        cmd = finds[2].split(' ')[0]
        flag = False
        print('params:', valve, cmd)
        pin = Pin(valves[valve], Pin.OUT)
        for v in valves.keys():
            if v == valve:
                flag = True
                if cmd == 'open':
                    pin.value(1)
                    print('open', v)
                    return {'status': 'success', 'data': {'valve': v, 'pin': pin.value()}}
                elif cmd == 'close':
                    pin.value(0)
                    print('close', v)
                    return {'status': 'success', 'data': {'valve': v, 'pin': pin.value()}}
                else:
                    return {'status': 'fail', 'message': 'Command not found'}
        if not flag:
            return {'status': 'fail', 'message': 'Valve not found'}

def create_http_response(response_body):
    response = 'HTTP/1.1 200 OK\r\n'
    response += 'Content-Type: application/json\r\n'
    response += 'Content-Length: {}\r\n'.format(len(response_body))
    response += '\r\n'
    response += response_body
    return response

def start_server():
    addr = socket.getaddrinfo('0.0.0.0', 8080)[0][-1]
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(addr)
    s.listen(1)
    print('Listening on', addr)

    while True:
        cl, addr = s.accept()
        print('Client connected from', addr)
        request = cl.recv(1024)
        result = handle_request(request.decode())
        response_body = ujson.dumps(result)
        response = create_http_response(response_body)
        cl.send(response)
        cl.close()

connect_to_wifi()
start_server()
