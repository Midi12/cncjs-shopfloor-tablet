function parseParams(str) {
    return str.split('&').reduce(function (params, param) {
        if (param) {
            var paramSplit = param.split('=').map(function (value) {
                return decodeURIComponent(value.replace('+', ' '));
            });
            params[paramSplit[0]] = paramSplit[1];
        }
        return params;
    }, {});
}

var params = parseParams(window.location.search.slice(1));
var root = window;
var token = params.token || '';
if (!token) {
    try {
        var cnc = {};
        cnc = JSON.parse(localStorage.getItem('cnc') || {});
        cnc.state = cnc.state || {};
        cnc.state.session = cnc.state.session || {};
        token = cnc.state.session.token || '';
        root.cnc.token = token;
    } catch (err) {
        // Ignore error
    }
}

// WebSocket
var socket = root.io.connect('', {
    query: 'token=' + token
});

var app = {
    connectPort: function () {
        var selectedPort = document.getElementById('portSelect').value;
        var selectedBaudRate = document.getElementById('baudRateSelect').value;

        socket.emit('open', selectedPort, {
            baudrate: Number(selectedBaudRate)
        });

        socket.on('open', function () {
            var connectButton = document.getElementById('connectButton');
            connectButton.textContent = 'Disconnect';
            connectButton.classList.remove('bg-blue-500');
            connectButton.classList.add('bg-red-500');
            connectButton.onclick = app.disconnectPort;
        });

        socket.on('error', function (err) {
            console.error('Connection error:', err);
        });
    },

    disconnectPort: function () {
        socket.emit('close');

        var connectButton = document.getElementById('connectButton');
        connectButton.textContent = 'Connect';
        connectButton.classList.remove('bg-red-500');
        connectButton.classList.add('bg-blue-500');
        connectButton.onclick = app.connectPort;
    },

    updateCoordinates: function (coordinates) {
        document.getElementById('xCoordinate').textContent = coordinates.x.toFixed(3);
        document.getElementById('yCoordinate').textContent = coordinates.y.toFixed(3);
        document.getElementById('zCoordinate').textContent = coordinates.z.toFixed(3);
    },

    updateSpindleSpeed: function (speed) {
        document.getElementById('spindleSpeed').textContent = speed;
    },

    updateGCodeList: function (files) {
        var gcodeSelect = document.getElementById('gcodeSelect');
        gcodeSelect.innerHTML = '';

        files.forEach(function (file) {
            var option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            gcodeSelect.appendChild(option);
        });
    },

    refreshGCodeList: function () {
        socket.emit('gcode:list');
    },

    loadGCode: function () {
        var selectedFile = document.getElementById('gcodeSelect').value;
        socket.emit('gcode:load', selectedFile);
    },

    startPauseJob: function () {
        var startPauseButton = document.getElementById('startPauseButton');

        if (startPauseButton.textContent === 'Start') {
            socket.emit('gcode:start');
            startPauseButton.textContent = 'Pause';
        } else {
            socket.emit('gcode:pause');
            startPauseButton.textContent = 'Start';
        }
    },

    unlockMachine: function () {
        socket.emit('unlock');
    },

    debug: function (message) {
        this.log(message, 'debug');
    },

    info: function (message) {
        this.log(message, 'info');
    },

    warn: function (message) {
        this.log(message, 'warn');
    },

    error: function (message) {
        this.log(message, 'error');
    },

    fatal: function (message) {
        this.log(message, 'fatal');
    },

    log: function (message, level) {
        var debugLogPanel = document.getElementById('debugLogPanel');
        var logLine = document.createElement('div');
        var timestamp = new Date().toISOString().substr(11, 12);
        var textColorClass = '';

        level_ = ['debug', 'info', 'warn', 'error', 'fatal'].includes(level) ? level : 'default';

        switch (level_) {
            case 'debug':
                textColorClass = 'text-cyan-400';
                break;
            case 'info':
                textColorClass = 'text-gray-100';
                break;
            case 'warn':
                textColorClass = 'text-yellow-500';
                break;
            case 'error':
                textColorClass = 'text-red-500';
                break;
            case 'fatal':
                textColorClass = 'text-purple-500';
                break;
            default:
                textColorClass = 'text-gray-100';
        }

        logLine.innerHTML = '<span>[' + timestamp + ']</span> <span>[' + level_.toUpperCase() + ']</span> <span class="' + textColorClass + '">' + message + '</span>';
        debugLogPanel.appendChild(logLine);
        debugLogPanel.scrollTop = debugLogPanel.scrollHeight;
    },

    setConnectButtonState: function (connected) {
        var connectButton = document.getElementById('connectButton');
        if (connected) {
            connectButton.textContent = 'Disconnect';
            connectButton.classList.remove('bg-blue-500');
            connectButton.classList.add('bg-red-500');
            connectButton.onclick = app.disconnectPort;
        } else {
            connectButton.textContent = 'Connect';
            connectButton.classList.remove('bg-red-500');
            connectButton.classList.add('bg-blue-500');
            connectButton.onclick = app.connectPort;
        }
    },

    setButtonState: function (buttonId, enabled) {
        var button = document.getElementById(buttonId);
        if (enabled) {
            button.removeAttribute('disabled');
            button.classList.remove('bg-gray-500', 'cursor-not-allowed');
            button.classList.add('bg-gray-800', 'hover:bg-gray-700');
        } else {
            button.setAttribute('disabled', 'true');
            button.classList.remove('bg-gray-800', 'hover:bg-gray-700');
            button.classList.add('bg-gray-500', 'cursor-not-allowed');
        }
    },

    setConnectionStatus: function (element, connected) {
        var statusElement = document.getElementById(element);
        var valueElement = statusElement.querySelector('span');

        if (connected) {
            valueElement.textContent = 'Connected';
            valueElement.classList.remove('text-red-500');
            valueElement.classList.add('text-green-500');
        } else {
            valueElement.textContent = 'Disconnected';
            valueElement.classList.remove('text-green-500');
            valueElement.classList.add('text-red-500');
        }
    },

    setStats: function (element, value, pad, unit) {
        var statElement = document.getElementById(element);
        var valueElement = statElement.querySelector('span');
        valueElement.textContent = value.toString().padStart(pad, '0') + ' ' + unit;
    },

    setCpuStats: function (value) {
        this.setStats('cpuStat', value, 4, 'Mhz');
    },

    setMemStats: function (value) {
        this.setStats('memStat', value, 3, 'Mb');
    },

    setSwapStats: function (value) {
        this.setStats('swapStat', value, 4, 'Mb');
    },

    setTempStats: function (value) {
        this.setStats('tempStat', value, 2, '°C');
    },

    setCoordinates: function (axis, value) {
        var coordinatesElement = document.getElementById(axis + 'Coordinate');
        var valueElement = coordinatesElement.querySelector('span');
        valueElement.textContent = value.toFixed(3);
    },

    setSpindleSpeed: function (speed) {
        var spindleElement = document.getElementById('spindleSpeed');
        var valueElement = spindleElement.querySelector('span');
        valueElement.textContent = speed.toString().padStart(5, '0') + ' RPM';
    },

    setDefaultState: function () {
        // Generate list of available ports
        socket.emit('list');

        // Set connect button to enabled and in connect state
        this.setConnectButtonState(false);

        // Set refresh, load, start, and lock buttons to disabled state
        this.setButtonState('refreshButton', false);
        this.setButtonState('loadButton', false);
        this.setButtonState('startPauseButton', false);
        this.setButtonState('lockUnlockButton', false);

        // Set port and cncjs connection status to disconnected
        this.setConnectionStatus('portStatus', false);
        this.setConnectionStatus('cncjsStatus', false);

        // Set CPU, memory, swap, and temperature stats to 0
        this.setCpuStats(0);
        this.setMemStats(0);
        this.setSwapStats(0);
        this.setTempStats(0);

        // Set X, Y, Z coordinates and spindle speed to 0
        this.setCoordinates('x', 0);
        this.setCoordinates('y', 0);
        this.setCoordinates('z', 0);
        this.setSpindleSpeed(0);
    },

    init: function () {
        document.getElementById('connectButton').onclick = this.connectPort;
        document.getElementById('refreshButton').onclick = this.refreshGCodeList;
        document.getElementById('loadButton').onclick = this.loadGCode;
        document.getElementById('startPauseButton').onclick = this.startPauseJob;
        document.getElementById('lockUnlockButton').onclick = this.unlockMachine;

        socket.on('status', function (status) {
            this.updateCoordinates(status.machine.position);
            this.updateSpindleSpeed(status.spindle.speed);
        });

        socket.on('gcode:list', function (files) {
            this.updateGCodeList(files);
        });

        this.setDefaultState();

        this_ = this;

        socket.on('serialport:list', function (ports) {
            var portSelect = document.getElementById('portSelect');
            portSelect.innerHTML = '';

            this_.debug( 'Received ' + ports.length + ' ports' );

            ports.forEach(function (portObject) {
                portText = portObject.port;
                if (portObject.hasOwnProperty('manufacturer')) {
                    portText += ' (' + portObject.manufacturer + ')'
                }

                this_.debug( 'Port : ' + portText );

                var option = document.createElement('option');
                option.value = portObject.port;
                option.textContent = portText;
                portSelect.appendChild(option);

                if (portObject.hasOwnProperty('inuse') && portObject.inuse === true) {
                    this_.debug( 'Port in use -> fire connect() callback' );
                }
            });
        });

        this.info('Application initialized.');
    }
};

app.init();