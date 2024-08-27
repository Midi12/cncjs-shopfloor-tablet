var gApp = {
    selectedPort: null,
    selectedBaudRate: null,
    logger: null,
    grbl_log: null,
    cncjsServerUrl: 'http://localhost:8000',
    socket: null,
    apiClient: null,
    controller: {
        state: null,
        settings: null
    },
    workflowState: 'idle',
    spindleOn: false,
    gcodeJobStarted: false,
    gcodeJobPaused: false,
    gcodeLoaded: false,
    hold: true,

    toggleSpindle: function (app) {
        var command = '';
        if (app.spindleOn == false) {
            command = 'M3 S5000';
            app.spindleOn = true;
            app.setSpindleSpeed(5000);
        } else {
            command = 'M5';
            app.spindleOn = false;
            app.setSpindleSpeed(0);
        }

        app.command(app, 'gcode', command);
    },

    toggleCommandList: function () {
        var commandList = document.getElementById('commandList');
        commandList.classList.toggle('hidden');
        document.body.classList.toggle('overflow-hidden');
    },

    generateCommandButtons: function (app, records) {
        var commandList = document.getElementById('commandList');
        commandList.innerHTML = ''; // Clear existing content

        for (var key in records) {
            if (records.hasOwnProperty(key)) {
                var record = records[key];
                var id = record.id;
                var title = record.title;

                var button = document.createElement('button');
                button.textContent = title;
                button.classList.add('bg-gray-700', 'text-white', 'px-4', 'py-2', 'rounded', 'mb-2');
                button.onclick = (function (id) {
                    return function () {
                        app.runCommand(app, id);
                    };
                })(id);
                commandList.appendChild(button);
            }
        }
    },

    runCommand: function (app, id) {
        app.apiClient.post('/api/commands/run/' + id)
            .then(data => {
                app.logger.debug('ran command ' + id);
                app.logger.debug(data);
            })
            .catch(error => app.logger.error(error));
    },

    connectPort: function (app) {
        app.setEnabledProperty('connectButton', false);
        app.selectedPort = document.getElementById('portSelect').value;
        app.selectedBaudRate = document.getElementById('baudRateSelect').value;

        app.logger.debug('Selected Baud rate : ' + app.selectedBaudRate);

        app.socket.emit('open', app.selectedPort, {
            baudrate: Number(app.selectedBaudRate)
        });
    },

    disconnectPort: function (app) {
        app.logger.info('Disconnecting from ' + app.selectedPort);

        app.socket.emit('close');

        app.setConnectButtonState(app, false);
        app.selectedPort = null;
        app.selectedBaudRate = null;
        app.setConnectionStatus('portStatus', false);

        app.setButtonState('refreshButton', false);
        app.setButtonState('loadUnloadButton', false);
        app.setButtonState('startPauseButton', false);
        app.setButtonState('lockUnlockButton', false);

        app.setPadState(app, false);
    },

    updateGCodeList: function (app) {
        app.apiClient.get('/api/watch/files')
            .then(data => {
                // app.logger.debug('files');
                // app.logger.debug(data);

                var gcodeSelect = document.getElementById('gcodeSelect');
                gcodeSelect.innerHTML = '';

                data.files.forEach(function (fileEntry) {
                    var option = document.createElement('option');
                    option.value = fileEntry.name;
                    option.textContent = fileEntry.name;
                    gcodeSelect.appendChild(option);
                });
            })
            .catch(error => {
                app.logger.error(error);
            });
    },

    updateCommands: function (app) {
        app.apiClient.get('/api/commands')
            .then(data => {
                // app.logger.debug('commands');
                // app.logger.debug(data);

                document.getElementById('commandListButton').onclick = app.toggleCommandList;

                app.generateCommandButtons(app, data.records);
            })
            .catch(error => {
                app.logger.error(error);
            });
    },

    refreshGCodeList: function (app) {
        app.updateGCodeList(app);
    },

    loadUnloadGCode: function (app) {
        var loadUnloadButton = document.getElementById('loadUnloadButton');

        if (app.gcodeLoaded == true) {
            app.command(app, 'gcode:unload');
            app.gcodeLoaded = false;
            loadUnloadButton.textContent = 'Load';

        } else {
            var selectedFile = document.getElementById('gcodeSelect').value;
            app.command(app, 'watchdir:load', selectedFile);

            app.gcodeLoaded = true;
            loadUnloadButton.textContent = 'Unload';
        }
    },

    startStopJob: function (app) {
        var startStopButton = document.getElementById('startStopButton');

        if (app.gcodeJobStarted == true) {
            app.command(app, 'gcode:stop');
            app.gcodeJobStarted = false;
            //app.gcodeJobPaused = false;
            startStopButton.textContent = 'Start';

            app.setButtonState('pauseResumeButton', false);
        } else {
            app.command(app, 'gcode:start');
            app.gcodeJobStarted = true;
            app.hold = false;
            holdUnholdButton.textContent = 'Hold';
            //app.gcodeJobPaused = false;
            startStopButton.textContent = 'Stop';

            app.setButtonState('pauseResumeButton', true);
        }
    },

    pauseResumeJob: function (app) {
        var pauseResumeButton = document.getElementById('pauseResumeButton');

        if (app.gcodeJobPaused == true) {
            app.command(app, 'gcode:resume');
            app.gcodeJobPaused = false;
            pauseResumeButton.textContent = 'Pause';
        } else {
            app.command(app, 'gcode:pause');
            app.gcodeJobPaused = true;
            pauseResumeButton.textContent = 'Resume';
        }
    },

    holdUnholdJob: function (app) {
        var holdUnholdButton = document.getElementById('holdUnholdButton');

        if (app.hold == true) {
            app.command(app, 'cyclestart');
            app.hold = false;
            holdUnholdButton.textContent = 'Hold';
        } else {
            app.command(app, 'feedhold');
            app.hold = true;
            holdUnholdButton.textContent = 'Unhold';
        }
    },

    unlockMachine: function (app) {
        app.socket.emit('unlock');
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

    moveAxis: function (app, axis, direction, distance = 0.5, factor = 1) {
        app.command(app, 'gcode', 'G91'); // Relative
        app.command(app, 'gcode', 'G0 ' + axis + (direction * distance * factor));
        app.command(app, 'gcode', 'G90'); // Absolute
    },

    zeroXY: function (app) {
        app.command(app, 'gcode', 'G28.3 X0 Y0 Z0');
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
        app.socket.emit('list');

        // Set connect button to enabled and in connect state
        app.setConnectButtonState(app, false);

        // Set refresh, load, start, and lock buttons to disabled state
        app.setButtonState('refreshButton', false);
        app.setButtonState('loadUnloadButton', false);
        app.setButtonState('startStopButton', false);
        app.setButtonState('pauseResumeButton', false);
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
    command: function (app, cmd) {
        var args = Array.prototype.slice.call(arguments, 2);

        app.logger.debug('port: ' + app.selectedPort + 'command ' + cmd + ' args -> ');
        app.logger.debug(args);

        app.socket.emit.apply(app.socket, ['command', app.selectedPort, cmd].concat(args));
    },

    writeln: function (app, data, context) {
        app.socket.emit('writeln', app.selectedPort, data, context);
    },

    commandHome: function (app) {
        app.command(app, 'homing');
    },

    executeProbe: function (app) {
        // https://github.com/cncjs/cncjs/blob/b1735c1e3cab191d462d2c5aee567a6e9065ed63/src/app/widgets/Probe/index.jsx#L187

        var probeDepth = parseFloat(document.getElementById('probeDepth').value);
        var probeFeedrate = parseFloat(document.getElementById('probeFeedrate').value);
        var touchPlateThickness = parseFloat(document.getElementById('touchPlateThickness').value);
        var retractionDistance = parseFloat(document.getElementById('retractionDistance').value);

        const make_gcode = (cmd, params) => {
            var s = '';
            for (var letter in params) {
                if (params.hasOwnProperty(letter)) {
                    var value = params[letter];
                    s += letter + value + ' ';
                }
            }
            s = s.trim(); // Remove trailing whitespace
            return (s.length > 0) ? (cmd + ' ' + s) : cmd;
        };

        var probeAxis = 'Z';
        var towardWorkpiece = true;
        var wcs = app.controller.state.parserstate.modal.wcs;
        var probeCommand = 'G38.2';

        const mapWCSToP = (wcs) => ({
            'G54': 1,
            'G55': 2,
            'G56': 3,
            'G57': 4,
            'G58': 5,
            'G59': 6
        }[wcs] || 0);

        const gcodeProbeCommands = Array.from([
            // Probe (use relative distance mode)
            //make_gcode(`; ${probeAxis}-Probe`),
            make_gcode('G91'),
            make_gcode(probeCommand, {
                [probeAxis]: towardWorkpiece ? -probeDepth : probeDepth,
                F: probeFeedrate
            }),
            // Use absolute distance mode
            make_gcode('G90'),

            // Set the WCS 0 offset
            //make_gcode(`; Set the active WCS ${probeAxis}0`),
            make_gcode('G10', {
                L: 20,
                P: mapWCSToP(wcs),
                [probeAxis]: touchPlateThickness
            }),

            // Retract from the touch plate (use relative distance mode)
            //make_gcode('; Retract from the touch plate'),
            make_gcode('G91'),
            make_gcode('G0', {
                [probeAxis]: retractionDistance
            }),
            // Use absolute distance mode
            make_gcode('G90')
        ]);

        for (let i = 0; i < gcodeProbeCommands.length; i++) {
            app.command(app, 'gcode', gcodeProbeCommands[i]);
        }

        app.toggleProbePanel(app);
    },

    toggleProbePanel: function (app) {
        var probePanel = document.getElementById('probePanel');
        probePanel.classList.toggle('hidden');
        document.body.classList.toggle('overflow-hidden');
    },

    setButtonsAction: function (app) {
        document.getElementById('connectButton').onclick = function () { app.connectPort(app) };
        document.getElementById('refreshButton').onclick = function () { app.refreshGCodeList(app) };
        document.getElementById('loadUnloadButton').onclick = function () { app.loadUnloadGCode(app) };
        document.getElementById('startStopButton').onclick = function () { app.startStopJob(app) };
        document.getElementById('holdUnholdButton').onclick = function () { app.holdUnholdJob(app) };
        document.getElementById('pauseResumeButton').onclick = function () { app.pauseResumeJob(app) };
        document.getElementById('lockUnlockButton').onclick = function () { app.unlockMachine(app) };

        document.getElementById('probeZButton').onclick = function () { app.toggleProbePanel(app) };
        document.getElementById('yPlusButton').onclick = function () { app.moveAxis(app, 'Y', 1) };
        document.getElementById('zPlusButton').onclick = function () { app.moveAxis(app, 'Z', 1) };
        document.getElementById('custom1Button').onclick = function () { };
        document.getElementById('xMinusButton').onclick = function () { app.moveAxis(app, 'X', -1) };
        document.getElementById('homeButton').onclick = function () { app.commandHome(app) };
        document.getElementById('xPlusButton').onclick = function () { app.moveAxis(app, 'X', 1) };
        document.getElementById('spindleOnOffButton').onclick = function () { app.toggleSpindle(app) };
        document.getElementById('zeroXYButton').onclick = function () { app.zeroXY(app) };
        document.getElementById('yMinusButton').onclick = function () { app.moveAxis(app, 'Y', -1) };
        document.getElementById('zMinusButton').onclick = function () { app.moveAxis(app, 'Z', -1) };
        document.getElementById('custom2Button').onclick = function () { };

        document.getElementById('probePanelButton').onclick = function () { app.executeProbe(app) };
        document.getElementById('cancelProbePanelButton').onclick = function () { app.toggleProbePanel(app) };

        document.getElementById('probeDepth').value = 10;
        document.getElementById('probeFeedrate').value = 20;
        document.getElementById('touchPlateThickness').value = 12;
        document.getElementById('retractionDistance').value = 4;
    },

    initCallbacks: function (app) {
        app.socket.on('feeder:status', function (feederStatusObject) {
            app.logger.debug('feeder:status feederStatusObject');
            app.logger.debug(feederStatusObject);
        });

        app.socket.on('sender:status', function (senderStatusObject) {
            app.logger.debug('sender:status senderStatusObject');
            app.logger.debug(senderStatusObject);
        });

        app.socket.on('serialport:read', function (readObject) {
            app.grbl_log.info('< ' + readObject);
        });

        app.socket.on('serialport:write', function (writeObject) {
            app.grbl_log.info('> ' + writeObject);
        });

        app.socket.on('serialport:list', function (ports) {
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

        app.socket.on('serialport:open', function (portObject) {
            //app.logger.debug(portObject);

            app.setConnectButtonState(app, true);
            app.setEnabledProperty('connectButton', true);
            app.selectedPort = portObject.port;
            app.selectedBaudRate = Number(portObject.baudrate);
            app.logger.info('Connected to ' + app.selectedPort);
            app.setConnectionStatus('portStatus', true);

            app.setButtonState('refreshButton', true);
            app.setButtonState('loadUnloadButton', true);
            app.setButtonState('startStopButton', true);
            app.setButtonState('pauseResumeButton', false);
            app.setButtonState('holdUnholdButton', true);
            app.setButtonState('lockUnlockButton', true);

            app.setPadState(app, true);

            app.command(app, 'reset');
            app.writeln('$$');
            app.writeln('!');
        });

        app.socket.on('serialport:error', function (err) {
            app.logger.error('Connection error to' + selectedPort + ' : ' + err);
            app.setEnabledProperty('connectButton', true);
            app.selectedPort = null;
            app.selectedBaudRate = null;
            app.setConnectButtonState(app, false);
            app.setConnectionStatus('portStatus', false);

            app.setButtonState('refreshButton', false);
            app.setButtonState('loadUnloadButton', false);
            app.setButtonState('startPauseButton', false);
            app.setButtonState('lockUnlockButton', false);

            app.setPadState(app, false);
        });

        app.socket.on('status', function (status) {
            app.setCoordinates('x', status.machine.position.x.toFixed(3));
            app.setCoordinates('y', status.machine.position.y.toFixed(3));
            app.setCoordinates('z', status.machine.position.z.toFixed(3));
            app.setSpindleSpeed(status.spindle.speed);
        });

        app.socket.on('controller:state', function (type, state) {
            app.logger.info('controller:state (' + type + ')');
            app.logger.debug(state);

            app.controller.state = state;
        });

        app.socket.on('controller:settings', function (type, settings) {
            app.logger.info('controller:settings (' + type + ')');
            app.logger.debug(settings);
        });

        app.socket.on('controller:ready', function () {
            app.logger.info('controller:ready');
        });

        app.socket.on('gcode:load', function (file, gcode) {
            app.logger.info('Loaded GCode file ' + file + ' (size: ' + gcode.length + ' bytes)');
        });

        app.socket.on('workflow:state', function (state) {
            app.logger.info('workflow:state : ' + state);
            app.workflowState = state;
        });
    },

    init: function (app) {
        app.state = {
            session: null
        };

        app.apiClient = new RestApiClient();
        app.apiClient.setBaseUrl(app.cncjsServerUrl);

        app.logger = new PrettyLogger('debugLogPanel');
        app.grbl_log = new PrettyLogger('grblLogPanel');

        app.apiClient.post('/api/signin')
            .then(data => {
                app.logger.debug('signin ok');
                app.logger.debug(data);

                app.state.session = data;

                app.apiClient.setHeader('Authorization', 'Bearer ' + app.state.session.token);

                // WebSocket
                app.socket = window.io.connect('', {
                    query: 'token=' + app.state.session.token
                });

                app.setDefaultState(app);
                app.setButtonsAction(app);
                app.initCallbacks(app);

                app.updateGCodeList(app);

                app.updateCommands(app);

                app.setConnectionStatus('cncjsStatus', true);

                app.logger.info('Application initialized.');
            })
            .catch(error => {
                app.logger.error('signin error');
                app.logger.error(error);
            });
    }
};

gApp.init(gApp);