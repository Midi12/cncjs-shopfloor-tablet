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

    init: function () {
        document.getElementById('connectButton').onclick = app.connectPort;
        document.getElementById('refreshButton').onclick = app.refreshGCodeList;
        document.getElementById('loadButton').onclick = app.loadGCode;
        document.getElementById('startPauseButton').onclick = app.startPauseJob;
        document.getElementById('lockUnlockButton').onclick = app.unlockMachine;

        socket.on('status', function (status) {
            app.updateCoordinates(status.machine.position);
            app.updateSpindleSpeed(status.spindle.speed);
        });

        socket.on('gcode:list', function (files) {
            app.updateGCodeList(files);
        });

        app.info('Application initialized.');
    }
};

app.init();