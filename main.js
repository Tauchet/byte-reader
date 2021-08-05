const data = "c3 24 1f 90 b0 a4 65 ec fe 1c a7 84 50 18 40 29 e3 00 00 00";
const charForBits = 4;
const BITS_FOR_BYTE = 8;

const ICMP_TYPES = {
    '00-00': '(Type: 0, Code: 0) Echo reply (to ping)',
    '03-00': '(Type: 3, Code: 0) Destination network unreachable',
    '03-01': '(Type: 3, Code: 1) Destination host unreachable',
    '03-02': '(Type: 3, Code: 2) Destination protocol unreachable',
    '03-03': '(Type: 3, Code: 3) Destination port unreachable',
    '03-06': '(Type: 3, Code: 6) Destination network unknown',
    '03-07': '(Type: 3, Code: 7) Destination host unknown',
    '04-00': '(Type: 4, Code: 0) Source quench (Congestion control)',
    '08-00': '(Type: 8, Code: 0) Echo request',
    '09-00': '(Type: 9, Code: 0) Router advertisement',
    '10-00': '(Type: 10, Code: 0) Router discovery',
    '11-00': '(Type: 11, Code: 0) TTL expired',
    '12-00': '(Type: 12, Code: 0) IP header bad'
}

function renderSpaces(string, splitted = null) {

    if (splitted == null) {
        splitted = string.length;
    }

    var spaces = (string.length - (string.length % splitted)) / splitted;
    if (string.length % splitted > 0) {
        spaces++;
    }

    var result = [];

    for (var spaceIndex = 0; spaceIndex < spaces; spaceIndex++) {
        const substring = string.substring(spaceIndex * splitted, (spaceIndex + 1) * splitted);
        result.push(substring);
    }

    return result;
}

function transformToHexadecimal(array, size = 2) {
    var result = [];
    for (var item of array) {
        result.push(formatSpaces(parseInt(item, 2).toString(16), size));
    }
    return result;
}

function transformToDecimal(string, from, to) {
    return parseInt(string, from).toString(to);
}

function formatSpaces(line, length) {
    var spaces = "";
    for (var i = 0; i < (length - line.length); i++) {
        spaces += "0";
    }
    return spaces + line;
}

function BufferString(buffer) {
    this.buffer = buffer;
    this.markIndex = 0;
}

BufferString.prototype.readBits = function (length) {
    const initializeIndex = this.markIndex;
    this.markIndex += length;
    return this.buffer.substring(initializeIndex, initializeIndex + length);
}

BufferString.prototype.readMacAddress = function () {
    const string = this.readBits(BITS_FOR_BYTE * 6);
    const stringArray = renderSpaces(string, BITS_FOR_BYTE);
    const hexaArray = transformToHexadecimal(stringArray);
    return {
        hexadecimal: hexaArray.join("-"),
        bits: stringArray.join(' ')
    }
}

BufferString.prototype.readNumber = function (bits) {
    const string = this.readBits(bits);
    const stringArray = renderSpaces(string, BITS_FOR_BYTE);
    const hexaArray = transformToHexadecimal(stringArray);
    const hexaString = hexaArray.join("-");
    return {
        hexadecimal: hexaString,
        bits: stringArray.join(' '),
        decimal: transformToDecimal(hexaArray.join(""), 16, 10)
    };
}

BufferString.prototype.readICMP = function () {
    const result = this.readNumber(2 * BITS_FOR_BYTE);
    result.icmp = ICMP_TYPES[result.hexadecimal];
    return result;
}

const BASES = [];

BufferString.prototype.readNumberWrapper = function (length = 4, type = 'w32') {
    const result = {};
    const bits = this.readBits(length);

    result.hexadecimal = transformToHexadecimal(renderSpaces(bits, 2)).join("-");
    result.bits_format = bits;
    result[type] = parseInt(bits, 2);

    if (result.w32 == undefined) {
        if (result.bytes == undefined) {
            result.w32 = (result.bits / 8) / 4;
        } else {
            result.w32 = result.bytes / 4;
        }
    }

    if (result.bytes == undefined) {
        if (result.bits == undefined) {
            result.bytes = result.w32 * 4;
        } else {
            result.bytes = result.bits / 8;
        }
    }

    if (result.bits == undefined) {
        if (result.bytes == undefined) {
            result.bits = result.w32 * 4 * 8;
        } else {
            result.bits = result.bytes * 8;
        }
    }

    return result;
}

BufferString.prototype.readTypeService = function () {
    const result = this.readBits(3);
    return parseInt(result, result);
}



const SERVICES_FLAGS = {
    '1000': 'Bajo Retardo (Delay)',
    '0100': 'Alta tasa de transferencia (Throughput)',
    '0010': 'Alta confiabilidad (Reliability)',
    '0001': 'Bajo cost (Cost)'
}

BufferString.prototype.readFlags = function () {
    const result = this.readNumber(4);
    this.readBits(1);
    result.render = SERVICES_FLAGS[result.bits];
    return result;
}

BufferString.prototype.checkSum = function (log) {
    const lines = this.buffer.substring(0, 80) + this.buffer.substring(96, 96 + 64);
    const arrayBytes = renderSpaces(lines, 16);
    const arrayHexadecimal = transformToHexadecimal(arrayBytes, 4);
    const steps = [];
    for (var i = 0; i < arrayHexadecimal.length; i += 2) {
        const a = arrayHexadecimal[i];
        const numberA = parseInt(a, 16);
        const b = arrayHexadecimal[i + 1];
        const numberB = parseInt(b, 16);
        const result = (numberA + numberB).toString(16);
        const max = Math.max(a ? a.length : 0, b ? b.length : 0);
        if (b !== undefined) {
            steps.push('<p>' + formatSpaces(a, max, ' ') + ' ÷ ' + formatSpaces(b, max, ' ') + ' = ' + formatSpaces(result, max, '|') + '</p>');
        } else {
            const decimal = parseInt('FFFF', 16) - parseInt(a, 16);
            steps.push('<p><strong>Resultado</strong></p>');
            steps.push('<p>' + formatSpaces('FFFF', max) + ' - ' + formatSpaces(a, max,) + ' = ' + formatSpaces(decimal.toString(16), max) + '</p>');
            break;
        }
        if (result.length > 4) {
            arrayHexadecimal.splice(i + 2, 0, result.substring(result.length - 4));
            arrayHexadecimal.splice(i + 3, 0, result.substring(0, result.length - 4));
        } else {
            arrayHexadecimal.splice(i + 2, 0, result);
        }
    }
    writeLogContent(log, 'Suma de Verificación', steps.join('\n'));
    return steps;
}

const NUMBER_BITS_TYPES = {
    bytes: {
        w64(value) {
            return value * 8;
        },
        w32(value) {
            return value * 4;
        }
    },
    bits: {
        w64(value) {
            return value * 8 * 8;
        },
        bytes(value) {
            return value * 8;
        },
        w32(value) {
            return value * 4 * 8;
        }
    }
}

BufferString.prototype.readIntegerBits = function (bitsLength) {
    var bits = this.readBits(bitsLength);
    var arrayBits = renderSpaces(bits, 8);
    return {
        value: parseInt(bits, 2),
        bits: arrayBits.join(' '),
        hexa: transformToHexadecimal(arrayBits).join(' ')
    };
}

BufferString.prototype.readNumberBits = function (bitsLength, type = 'w64') {
    const result = {};
    const bits = this.readBits(bitsLength);
    var arrayBits = renderSpaces(bits, 8);
    const decimal = parseInt(bits, 2);
    result[type] = decimal;
    for (var subType in NUMBER_BITS_TYPES) {
        if (subType != null && NUMBER_BITS_TYPES[subType][type]) {
            result[subType] = NUMBER_BITS_TYPES[subType][type](decimal);
        }
    }
    result.value_bits = arrayBits.join(' ');
    result.value_hexa = transformToHexadecimal(arrayBits).join(' ');
    return result;
}

BufferString.prototype.readAddress = function () {
    const buffer = this.readBits(32);
    const arrayBits = renderSpaces(buffer, 8);
    const arrayHexa = [];
    const arrayDecimal = [];
    for (var item of arrayBits) {
        const number = parseInt(item, 2);
        arrayHexa.push(number.toString(16));
        arrayDecimal.push(number);
    }
    return {
        bits: arrayBits.join(', '),
        hexadecimal: arrayHexa.join('-'),
        decimal: arrayDecimal.join('.')
    }
}

BufferString.prototype.readRemainingBits = function () {
    const result = this.buffer.substring(this.markIndex);
    this.markIndex += result.length;
    return result;
}


BufferString.prototype.readBufferBytes = function (bytes) {
    const result = this.buffer.substring(this.markIndex, this.markIndex + (bytes * BITS_FOR_BYTE));
    if (result.length == 0) {
        return null;
    } else {
        this.markIndex += result.length;
        return new BufferString(result);
    }
}

function writeLogContent(log, title, content) {
    log.push('<div class="item"><div class="item-name"><p>' + title + '</p></div><div class="item-content">' + content + '</div></div>');
}

function escapeHTML(s) { 
    return s.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

BufferString.prototype.readHTTP = function (log) {

    log.push("=============================================");
    log.push("<h3>HTTP</h3>");
    log.push("=============================================");

    const bits = this.readRemainingBits();
    const arrayBits = renderSpaces(bits, 8);
    const hexa = transformToHexadecimal(arrayBits);
    const chars = [];

    var tempChars = [];
    var tempHexa = [];

    var contentHTML = "";
    var textHTML = "";

    for (var item of hexa) {
        const ascii = hex_to_ascii(item);
        tempChars.push(ascii);
        tempHexa.push(item);
        if (ascii === '\n') {

            const stringLine = escapeHTML(tempChars.join('').split('\n').join('\\n').split('\r').join('\\r'));
            const stringHexa = tempHexa.join(' ');

            console.log(stringLine)

            if (stringLine === '\r\n') {
                textHTML += "<p><strong>Entity</strong></p>";
            }

            chars.push({
                line: stringLine,
                hexa: stringHexa
            });

            contentHTML += "<div class='line'><p>"+ stringLine + "</p><p>"+ stringHexa + "</p></div>";
            textHTML += "<p>"+ stringLine + "</p>";

            tempChars = [];
            tempHexa = [];
        }
    }

    writeLogContent(log, 'Contenido', textHTML);
    writeLogContent(log, 'Parametros', contentHTML);

    var result = {
        header: [],
        entity: [],
        all: chars
    };

    var mode = false;

    for (var item of chars) {
        if (item.line === '\r\n') {
            mode = true;
        } else if (mode) {
            result.entity.push(item);
        } else {
            result.header.push(item);
        }
    }

    return result;
}

function hex_to_ascii(str1) {
    var hex = str1.toString();
    var str = '';
    for (var n = 0; n < hex.length; n += 2) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
}

function writeLog(log, title, value) {
    var content = '<p>' + value + '</p>';
    if (typeof value === 'object') {
        content = '';
        for (var key in value) {
            var item = value[key];
            content += '<p><strong>' + key + ': </strong>' + item + '<p>';
        }
    }
    log.push('<div class="item"><div class="item-name"><p>' + title + '</p></div><div class="item-content">' + content + '</div></div>');
}

Vue.config.devtools = true;

const $app = new Vue({
    el: '#app',
    data() {
        return {
            typeConfig: 0,
            data: '',
            lines: []
        }
    },
    computed: {
        log() {
            return this.lines.join('\n');
        }
    },
    methods: {
        clicked() {

            this.lines = [];
            const log = this.lines;

            const wrapperData = this.data.split('\n').join(' ').replace(/ /g,'');
            var buffer = wrapperData.split(' ').join('');
            var cloned = [];

            if (charForBits > 1) {
                var array = [];
                const bufferArray = buffer.split('');
                for (char of bufferArray) {
                    const value = formatSpaces(parseInt(char, Math.pow(2, charForBits)).toString(2), charForBits);
                    array.push(value);
                    cloned.push(value);
                }
                buffer = array.join('');
            }

            buffer = new BufferString(buffer);
            let protocol = 0;

            const STRUCTURE = [{
                title: 'Frame',
                bytes: 14,
                execute(buffer) {
                    writeLog(log, "Dirección IP Origen", buffer.readMacAddress());
                    writeLog(log, "Dirección IP Destino", buffer.readMacAddress());
                    writeLog(log, "Tamaño", buffer.readICMP());
                }
            }, {
                title: 'Datagrama',
                bytes: 20,
                execute(buffer) {
                    writeLog(log, 'Versión', buffer.readIntegerBits(4));
                    writeLog(log, 'Longitud del encabezado', buffer.readNumberBits(4, "w32"));
                    writeLog(log, 'Servicios Diferenciales (Prioridad)', buffer.readBits(3));
                    writeLog(log, 'Servicios Diferenciales (Flags)', buffer.readBits(4));
                    writeLog(log, 'Servicios Diferenciales (Bit inútil)', buffer.readBits(1));
                    writeLog(log, 'Identificación', buffer.readIntegerBits(16));
                    writeLog(log, 'Longitud Total', buffer.readNumberBits(16, "bytes"));
                    writeLog(log, "Bit 0 (Reservado)", buffer.readBits(1))
                    writeLog(log, "Bit 1 (DF) No Fragmentar (Don't Fragment)", buffer.readBits(1));
                    writeLog(log, "Bit 2 (MF) Más Fragmentos (More Fragments)", buffer.readBits(1));
                    writeLog(log, "Desplazamiento", buffer.readNumberBits(13, "w64"));
                    writeLog(log, "Tiempo de Vida", buffer.readIntegerBits(8));
                    writeLog(log, "Protocolo (Nivel Superior)", protocol = buffer.readIntegerBits(8));
                    writeLog(log, "Suma de Comprobación", buffer.readIntegerBits(16));
                    writeLog(log, "Dirección IP Origen", buffer.readAddress());
                    writeLog(log, "Dirección IP Destino", buffer.readAddress());
                    buffer.checkSum(log);
                }
            }, {
                title: 'Segmento',
                bytes: 20,
                execute(buffer) {
                    writeLog(log, "Puerto Origen:", buffer.readIntegerBits(BITS_FOR_BYTE * 2));
                    writeLog(log, "Puerto Destino:", buffer.readIntegerBits(BITS_FOR_BYTE * 2));
                    writeLog(log, "Extra:", buffer.readBits(16 * BITS_FOR_BYTE));
                }
            }];


            for (var i = this.typeConfig; i < STRUCTURE.length; i++) {
                const typeData = STRUCTURE[i];
                const miniBuffer = buffer.readBufferBytes(typeData.bytes);
                var arrayBits = renderSpaces(typeData.bytes, 8);
                var arrayHexa = transformToHexadecimal(arrayBits).join(' ');
                if (miniBuffer != null) {
                    this.lines.push("=============================================");
                    this.lines.push("<h3>" + typeData.title + "</h3>");
                    this.lines.push(arrayBits.join(' '));
                    this.lines.push(arrayHexa);
                    this.lines.push("=============================================");
                    typeData.execute(miniBuffer);
                }
            }

            // HTTP
            if (protocol.value === 6) {
                const value = buffer.readHTTP(log);
                console.log(value);
            }

        }
    }
});