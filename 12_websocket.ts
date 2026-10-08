// RFC 6455 server framing for ESP-AT TCP sockets. Bounded to 5 clients / 1024-byte text messages.
namespace BrixelWebSocket {
    let pending: string[] = ["", "", "", "", ""]
    let opened: boolean[] = [false, false, false, false, false]
    let fragments: string[] = ["", "", "", "", ""]
    let fragmented: boolean[] = [false, false, false, false, false]
    let sendPacket: (id: number, packet: Buffer) => boolean = null
    let received: (id: number, text: string) => void = null
    export function configure(send: (id: number, packet: Buffer) => boolean, message: (id: number, text: string) => void): void {
        sendPacket = send; received = message
        for (let i = 0; i < 5; i++) reset(i)
    }
    export function reset(id: number): void {
        if (id < 0 || id >= 5) return
        pending[id] = ""; opened[id] = false; fragments[id] = ""; fragmented[id] = false
    }
    export function binary(data: Buffer): string {
        let result = ""
        for (let i = 0; i < data.length; i++) result += String.fromCharCode(data[i])
        return result
    }
    function bytes(data: string): Buffer {
        let result = pins.createBuffer(data.length)
        for (let i = 0; i < data.length; i++) result[i] = data.charCodeAt(i)
        return result
    }
    function rotate(value: number, n: number): number { return (value << n) | (value >>> (32 - n)) }
    /** SHA-1 is required by the WebSocket handshake; it is not used for passwords or authentication. */
    export function acceptKey(key: string): string {
        let text = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        let data: number[] = []
        for (let i = 0; i < text.length; i++) data.push(text.charCodeAt(i))
        data.push(128)
        while (data.length % 64 != 56) data.push(0)
        let bits = text.length * 8
        for (let i = 0; i < 4; i++) data.push(0)
        for (let i = 3; i >= 0; i--) data.push((bits >>> (i * 8)) & 255)
        let h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]
        for (let off = 0; off < data.length; off += 64) {
            let w: number[] = []
            for (let i = 0; i < 16; i++) { let p = off + i * 4; w.push((data[p] << 24) | (data[p+1] << 16) | (data[p+2] << 8) | data[p+3]) }
            for (let i = 16; i < 80; i++) w.push(rotate(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1))
            let a=h[0], b=h[1], c=h[2], d=h[3], e=h[4]
            for (let i=0; i<80; i++) {
                let f=0, k=0
                if (i<20) { f=(b & c) | (~b & d); k=0x5A827999 }
                else if (i<40) { f=b ^ c ^ d; k=0x6ED9EBA1 }
                else if (i<60) { f=(b & c) | (b & d) | (c & d); k=0x8F1BBCDC }
                else { f=b ^ c ^ d; k=0xCA62C1D6 }
                let t=(rotate(a,5)+f+e+k+w[i]) | 0
                e=d; d=c; c=rotate(b,30); b=a; a=t
            }
            h[0]=(h[0]+a)|0; h[1]=(h[1]+b)|0; h[2]=(h[2]+c)|0; h[3]=(h[3]+d)|0; h[4]=(h[4]+e)|0
        }
        let digest: number[] = []
        for (let i=0;i<5;i++) for (let j=3;j>=0;j--) digest.push((h[i] >>> (j*8)) & 255)
        const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        let result=""
        for (let i=0;i<digest.length;i+=3) {
            let n=(digest[i]<<16) | ((i+1<digest.length?digest[i+1]:0)<<8) | (i+2<digest.length?digest[i+2]:0)
            result+=alphabet.charAt((n>>>18)&63)+alphabet.charAt((n>>>12)&63)
            result+=i+1<digest.length?alphabet.charAt((n>>>6)&63):"="
            result+=i+2<digest.length?alphabet.charAt(n&63):"="
        }
        return result
    }
    function frame(id: number, opcode: number, data: Buffer): boolean {
        if (!sendPacket || data.length > 1024) return false
        let header=data.length<126?2:4
        let packet=pins.createBuffer(header+data.length)
        packet[0]=128|opcode; packet[1]=data.length<126?data.length:126
        if (header==4) { packet[2]=data.length>>8; packet[3]=data.length&255 }
        for (let i=0;i<data.length;i++) packet[header+i]=data[i]
        return sendPacket(id,packet)
    }
    function close(id: number, code: number): void { frame(id,8,pins.createBufferFromArray([code>>8,code&255])); reset(id) }
    export function sendText(id: number, text: string): boolean {
        if (id<0 || id>=5 || !opened[id]) return false
        let data = Buffer.fromUTF8(text)
        if (data.length > 1024) return false
        if (frame(id,1,data)) return true
        reset(id)
        return false
    }
    export function feed(id: number, data: string): void {
        if (id<0 || id>=5) return
        pending[id]+=data
        if (pending[id].length>4096) { close(id,1009); return }
        if (!opened[id]) {
            let end=pending[id].indexOf("\r\n\r\n")
            if (end<0) { if(pending[id].length>2048) reset(id); return }
            let headers=pending[id].substr(0,end).split("\r\n"), key="", upgrade="", connection="", version=""
            for (let i=1;i<headers.length;i++) {
                let colon=headers[i].indexOf(":")
                if(colon<0) continue
                let name=headers[i].substr(0,colon).toLowerCase(), value=headers[i].substr(colon+1).trim()
                if(name=="sec-websocket-key") key=value
                if(name=="upgrade") upgrade=value.toLowerCase()
                if(name=="connection") connection=value.toLowerCase()
                if(name=="sec-websocket-version") version=value
            }
            let validKey=key.length==24 && key.substr(22)=="=="
            const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
            for(let i=0;i<22 && validKey;i++) if(chars.indexOf(key.charAt(i))<0) validKey=false
            let connectionUpgrade = false
            let tokens = connection.split(",")
            for (let i=0;i<tokens.length;i++) if(tokens[i].trim()=="upgrade") connectionUpgrade=true
            if(headers[0].indexOf("GET ")!=0 || upgrade!="websocket" || !connectionUpgrade || version!="13" || !validKey) {
                if(sendPacket) sendPacket(id,Buffer.fromUTF8("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"))
                reset(id); return
            }
            let response="HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "+acceptKey(key)+"\r\n\r\n"
            if(!sendPacket || !sendPacket(id,Buffer.fromUTF8(response))) { reset(id); return }
            opened[id]=true; pending[id]=pending[id].substr(end+4)
        }
        for(let count=0;count<16 && pending[id].length>=2;count++) {
            let raw=pending[id], first=raw.charCodeAt(0), second=raw.charCodeAt(1), opcode=first&15, fin=(first&128)!=0
            let length=second&127, head=2
            if((first&112)!=0 || (second&128)==0) { close(id,1002); return }
            if(length==127) { close(id,1009); return }
            if(length==126) { if(raw.length<4)return; length=raw.charCodeAt(2)*256+raw.charCodeAt(3); head=4; if(length<126) {close(id,1002);return} }
            if(length>1024 || (opcode>=8 && (!fin || length>125))) { close(id,1009); return }
            if(raw.length<head+4+length)return
            let payload=""
            for(let i=0;i<length;i++) payload+=String.fromCharCode(raw.charCodeAt(head+4+i)^raw.charCodeAt(head+(i%4)))
            pending[id]=raw.substr(head+4+length)
            if(opcode==8) {
                if(length==1) { close(id,1002); return }
                if(length>=2) {
                    let code=payload.charCodeAt(0)*256+payload.charCodeAt(1)
                    if(code<1000 || code>=5000 || (code>=1016 && code<3000) || code==1004 || code==1005 || code==1006 || code==1015) { close(id,1002); return }
                    let reason=payload.substr(2)
                    if(binary(Buffer.fromUTF8(bytes(reason).toString()))!=reason) {close(id,1007);return}
                }
                frame(id,8,bytes(payload)); reset(id); return
            }
            if(opcode==9) { frame(id,10,bytes(payload)); continue }
            if(opcode==10) continue
            if(opcode==1 && !fragmented[id]) { fragments[id]=payload; fragmented[id]=!fin }
            else if(opcode==0 && fragmented[id]) { fragments[id]+=payload; fragmented[id]=!fin }
            else { close(id,1002); return }
            if(fragments[id].length>1024) { close(id,1009); return }
            if(fin) {
                let text=bytes(fragments[id]).toString()
                if(binary(Buffer.fromUTF8(text))!=fragments[id]) { close(id,1007); return }
                fragments[id]=""
                if(received)received(id,text)
            }
        }
    }
}
