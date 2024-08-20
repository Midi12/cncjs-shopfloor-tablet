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

var gApp = {
    selectedPort: null,
    selectedBaudRate: null,
    logger: null,

    checkCncjsServer: function (app) {
        url = document.location;

        ping = new XMLHttpRequest();
        ping.onreadystatechange = function () {

            if (ping.readyState == 4) {
                app.setConnectionStatus('cncjsStatus', ping.status == 200)
            }
        }
        ping.open("GET", url, true);
        ping.send();
    },

    connectPort: function (app) {
        app.setEnabledProperty('connectButton', false);
        app.selectedPort = document.getElementById('portSelect').value;
        app.selectedBaudRate = document.getElementById('baudRateSelect').value;

        app.logger.debug('Selected Baud rate : ' + app.selectedBaudRate);

        socket.emit('open', app.selectedPort, {
            baudrate: Number(app.selectedBaudRate)
        });
    },

    disconnectPort: function (app) {
        app.logger.info('Disconnecting from ' + app.selectedPort);

        socket.emit('close');

        app.setConnectButtonState(app, false);
        app.selectedPort = null;
        app.selectedBaudRate = null;
        app.setConnectionStatus('portStatus', false);

        app.setButtonState('refreshButton', false);
        app.setButtonState('loadButton', false);
        app.setButtonState('startPauseButton', false);
        app.setButtonState('lockUnlockButton', false);

        app.setPadState(app, false);
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

    refreshGCodeList: function (app) {
        socket.emit('gcode:list');
    },

    loadGCode: function (app) {
        var selectedFile = document.getElementById('gcodeSelect').value;
        socket.emit('gcode:load', selectedFile);
    },

    startPauseJob: function (app) {
        var startPauseButton = document.getElementById('startPauseButton');

        if (startPauseButton.textContent === 'Start') {
            socket.emit('gcode:start');
            startPauseButton.textContent = 'Pause';
        } else {
            socket.emit('gcode:pause');
            startPauseButton.textContent = 'Start';
        }
    },

    unlockMachine: function (app) {
        socket.emit('unlock');
    },

    setConnectButtonState: function (app, connected) {
        var connectButton = document.getElementById('connectButton');
        if (connected) {
            connectButton.textContent = 'Disconnect';
            connectButton.classList.remove('bg-blue-500');
            connectButton.classList.add('bg-red-500');
            connectButton.onclick = function () { app.disconnectPort(app) };
        } else {
            connectButton.textContent = 'Connect';
            connectButton.classList.remove('bg-red-500');
            connectButton.classList.add('bg-blue-500');
            connectButton.onclick = function () { app.connectPort(app) };
        }
    },

    setEnabledProperty: function (elementId, state) {
        var element = document.getElementById(elementId);
        element.enabled = state;
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

    moveAxis: function(app, axis, direction, distance = 1, factor = 1) {
        app.command(app, 'gcode', 'G91'); // Relative
        app.command(app, 'gcode', 'G0 ' + axis + (direction * distance * factor));
        app.command(app, 'gcode', 'G90'); // Absolute
    },

    setSpindleSpeed: function (speed) {
        var spindleElement = document.getElementById('spindleSpeed');
        var valueElement = spindleElement.querySelector('span');
        valueElement.textContent = speed.toString().padStart(5, '0') + ' RPM';
    },

    setPadState: function (app, state) {
        app.setButtonState('probeZButton', state);
        app.setButtonState('yPlusButton', state);
        app.setButtonState('zPlusButton', state);
        app.setButtonState('custom1Button', state);
        app.setButtonState('xMinusButton', state);
        app.setButtonState('homeButton', state);
        app.setButtonState('xPlusButton', state);
        app.setButtonState('spindleOnOffButton', state);
        app.setButtonState('zeroXYButton', state);
        app.setButtonState('yMinusButton', state);
        app.setButtonState('zMinusButton', state);
        app.setButtonState('custom2Button', state);
    },

    setDefaultState: function (app) {
        // Generate list of available ports
        socket.emit('list');

        // Set connect button to enabled and in connect state
        app.setConnectButtonState(app, false);

        // Set refresh, load, start, and lock buttons to disabled state
        app.setButtonState('refreshButton', false);
        app.setButtonState('loadButton', false);
        app.setButtonState('startPauseButton', false);
        app.setButtonState('lockUnlockButton', false);

        // Set port and cncjs connection status to disconnected
        app.setConnectionStatus('portStatus', false);
        app.setConnectionStatus('cncjsStatus', false);

        app.setPadState(app, false);

        // Set CPU, memory, swap, and temperature stats to 0
        app.setCpuStats(0);
        app.setMemStats(0);
        app.setSwapStats(0);
        app.setTempStats(0);

        // Set X, Y, Z coordinates and spindle speed to 0
        app.setCoordinates('x', 0);
        app.setCoordinates('y', 0);
        app.setCoordinates('z', 0);
        app.setSpindleSpeed(0);
    },

    // @param {string} cmd The command string
    // @example Example Usage
    // - Load G-code
    //   controller.command('gcode:load', name, gcode, callback)
    // - Unload G-code
    //   controller.command('gcode:unload')
    // - Start sending G-code
    //   controller.command('gcode:start')
    // - Stop sending G-code
    //   controller.command('gcode:stop')
    // - Pause
    //   controller.command('gcode:pause')
    // - Resume
    //   controller.command('gcode:resume')
    // - Feed Hold
    //   controller.command('feedhold')
    // - Cycle Start
    //   controller.command('cyclestart')
    // - Status Report
    //   controller.command('statusreport')
    // - Homing
    //   controller.command('homing')
    // - Sleep
    //   controller.command('sleep')
    // - Unlock
    //   controller.command('unlock')
    // - Reset
    //   controller.command('reset')
    // - Feed Override
    //   controller.command('feedOverride')
    // - Spindle Override
    //   controller.command('spindleOverride')
    // - Rapid Override
    //   controller.command('rapidOverride')
    // - G-code
    //   controller.command('gcode', 'G0X0Y0')
    // - Load a macro
    //   controller.command('macro:load', '<macro-id>', { /* optional vars */ }, callback)
    // - Run a macro
    //   controller.command('macro:run', '<macro-id>', { /* optional vars */ }, callback)
    // - Load file from a watch directory
    //   controller.command('watchdir:load', '/path/to/file', callback)
    command: function(app, cmd) {
        var args = Array.prototype.slice.call(arguments, 2);

        app.logger.debug('port: ' + app.selectedPort + 'command ' + cmd + ' args -> ');
        app.logger.debug(args);

        socket.emit.apply(socket, ['command', app.selectedPort, cmd].concat(args));
    },

    writeln: function(app, data, context) {
        app.logger.debug('writeln');
        app.logger.debug(data);
        app.logger.debug(context);

        socket.emit('writeln', app.selectedPort, data, context);
    },

    commandHome: function(app) {
        app.command(app, 'homing');
    },

    setButtonsAction: function (app) {
        document.getElementById('connectButton').onclick = function () { app.connectPort(app) };
        document.getElementById('refreshButton').onclick = function () { app.refreshGCodeList(app) };
        document.getElementById('loadButton').onclick = function () { app.loadGCode(app) };
        document.getElementById('startPauseButton').onclick = function () { app.startPauseJob(app) };
        document.getElementById('lockUnlockButton').onclick = function () { app.unlockMachine(app) };

        document.getElementById('probeZButton').onclick = function() {};
        document.getElementById('yPlusButton').onclick = function() { app.moveAxis(app, 'Y', 1) };
        document.getElementById('zPlusButton').onclick = function() { app.moveAxis(app, 'Z', 1) };
        document.getElementById('custom1Button').onclick = function() {};
        document.getElementById('xMinusButton').onclick = function() { app.moveAxis(app, 'X', -1) };
        document.getElementById('homeButton').onclick = function() { app.commandHome(app) };
        document.getElementById('xPlusButton').onclick = function() { app.moveAxis(app, 'X', 1) };
        document.getElementById('spindleOnOffButton').onclick = function() {};
        document.getElementById('zeroXYButton').onclick = function() {};
        document.getElementById('yMinusButton').onclick = function() { app.moveAxis(app, 'Y', -1) };
        document.getElementById('zMinusButton').onclick = function() { app.moveAxis(app, 'Z', -1) };
        document.getElementById('custom2Button').onclick = function() {};
    },

    initCallbacks: function (app) {
        socket.on('serialport:list', function (ports) {
            var portSelect = document.getElementById('portSelect');
            portSelect.innerHTML = '';

            app.logger.debug('Received ' + ports.length + ' ports');

            ports.forEach(function (portObject) {
                portText = portObject.port;
                if (portObject.hasOwnProperty('manufacturer')) {
                    portText += ' (' + portObject.manufacturer + ')'
                }

                app.logger.debug('Port : ' + portText);

                var option = document.createElement('option');
                option.value = portObject.port;
                option.textContent = portText;
                portSelect.appendChild(option);

                if (portObject.hasOwnProperty('inuse') && portObject.inuse === true) {
                    app.logger.debug('Port in use, reconnecting to ' + portObject.port);

                    document.getElementById('portSelect').value = portObject.port;

                    app.connectPort(app);
                }
            });
        });

        socket.on('serialport:open', function (portObject) {
            //app.logger.debug(portObject);

            app.setConnectButtonState(app, true);
            app.setEnabledProperty('connectButton', true);
            app.selectedPort = portObject.port;
            app.selectedBaudRate = Number(portObject.baudrate);
            app.logger.info('Connected to ' + app.selectedPort);
            app.setConnectionStatus('portStatus', true);

            app.setButtonState('refreshButton', true);
            app.setButtonState('loadButton', true);
            app.setButtonState('startPauseButton', true);
            app.setButtonState('lockUnlockButton', true);

            app.setPadState(app, true);
        });

        socket.on('serialport:error', function (err) {
            app.logger.error('Connection error to' + selectedPort + ' : ' + err);
            app.setEnabledProperty('connectButton', true);
            app.selectedPort = null;
            app.selectedBaudRate = null;
            app.setConnectButtonState(app, false);
            app.setConnectionStatus('portStatus', false);

            app.setButtonState('refreshButton', false);
            app.setButtonState('loadButton', false);
            app.setButtonState('startPauseButton', false);
            app.setButtonState('lockUnlockButton', false);

            app.setPadState(app, false);
        });

        socket.on('status', function (status) {
            app.setCoordinates('x', status.machine.position.x.toFixed(3));
            app.setCoordinates('y', status.machine.position.y.toFixed(3));
            app.setCoordinates('z', status.machine.position.z.toFixed(3));
            app.setSpindleSpeed(status.spindle.speed);
        });

        socket.on('gcode:list', function (files) {
            app.updateGCodeList(files);
        });

        socket.on('controller:state', function(type, state) {
            app.logger.info('controller:state ('+type+')');
            app.logger.debug(state);
        });

        socket.on('controller:settings', function(type, settings) {
            app.logger.info('controller:settings ('+type+')');
            app.logger.debug(settings);
        });
    },

    init: function (app) {
        app.logger = new PrettyLogger('debugLogPanel');

        app.setDefaultState(app);
        app.setButtonsAction(app);
        app.initCallbacks(app);

        app.checkCncjsServer(app); // Checking rn

        setInterval(() => {
            app.checkCncjsServer(app);
        }, 60 * 1000);

        app.logger.info('Application initialized.');
    }
};

gApp.init(gApp);