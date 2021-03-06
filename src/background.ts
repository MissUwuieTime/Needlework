'use strict';

import {
  app,
  protocol,
  BrowserWindow,
  nativeImage,
  Tray,
  Menu,
} from 'electron';
import path from 'path';
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib';
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer';
import NeedleworkService from './services/NeedleworkService';
import DataDragonService from './services/DataDragonService';
import CommunityDragonService from './services/CommunityDragonService';
import ElectronService from './services/ElectronService';
import ElectronStoreService from './services/ElectronStoreService';
import { OpenDevToolsOptions } from 'electron/main';
import routes from './apis/needlework/src/data/routes';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
]);

type ServiceCollection = {
  needleworkService: NeedleworkService;
  dataDragonService: DataDragonService;
  communityDragonService: CommunityDragonService;
  electronService: ElectronService;
  electronStoreService: ElectronStoreService;
};

async function initializeServices(
  window: BrowserWindow
): Promise<ServiceCollection> {
  // Service modules
  const needleworkService = new NeedleworkService();
  await needleworkService.initialize(window);

  const dataDragonService = new DataDragonService();
  const communityDragonService = new CommunityDragonService();

  const electronService = new ElectronService();
  electronService.setWindow(window);

  const electronStoreService = ElectronStoreService.getInstance();

  return {
    needleworkService,
    dataDragonService,
    communityDragonService,
    electronService,
    electronStoreService,
  };
}

async function createTrayIcon(win: BrowserWindow, services: ServiceCollection) {
  let iconPath = '';
  if (isDevelopment) {
    iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  } else {
    iconPath = path.join(path.dirname(__dirname), 'extraResources', 'icon.png');
  }
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Needlework',
      type: 'normal',
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit Needlework',
      type: 'normal',
      click: () => {
        app.exit(0);
      },
    },
  ]);
  tray.setToolTip('Needlework');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    win.show();
  });

  if (services) {
    services.needleworkService.addFnToEventListener((messageDTO) => {
      const options: Electron.DisplayBalloonOptions = {
        title: '',
        content: '',
        iconType: 'info',
      };
      if (messageDTO.object.uri === routes.LOL_LOOT_READY) {
        options.title = 'Client Active';
        options.content =
          'Connected with the League client! Loot ready to be used. :bee_happy:';
      }
      if (messageDTO.object.uri === routes.CLIENT_INACTIVE) {
        options.title = 'Client Inactive';
        options.content =
          'Connection dropped with the League client! :bee_sad:';
      }
      if (options.title.length > 0) tray.displayBalloon(options);
    });
    const options: Electron.DisplayBalloonOptions = {
      title: '',
      content: '',
      iconType: 'info',
    };
    try {
      if (services.needleworkService.needlework?.isClientActive()) {
        options.title = 'Connected';
        options.content = 'Needlework has connected with the League client!';
      } else {
        options.title = 'Unable to connect';
        options.content =
          'Needlework failed to connect with the League client!';
      }
      tray.displayBalloon(options);
    } catch (error) {
      options.title = 'Error';
      options.content = 'Unknown error has occured!';
      console.log(error);
      tray.displayBalloon(options);
    }
  }

  return tray;
}

async function createWindow() {
  // Frameless for release, framed for testing.
  const isFrame = process.env.WEBPACK_DEV_SERVER_URL ? true : false;
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: isFrame,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: !!process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setResizable(false);

  const services = await initializeServices(win);
  tray = createTrayIcon(win, services);

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
    const options = {
      mode: 'detach',
    } as OpenDevToolsOptions;
    if (!process.env.IS_TEST) {
      win.webContents.openDevTools(options);
    }
  } else {
    createProtocol('app');
    // Load the index.html when not in development
    win.loadURL('app://./index.html');
    win.setMenu(null);
  }

  return win;
}

function registerLocalResourceProtocol() {
  protocol.registerFileProtocol('local-resource', (request, callback) => {
    const url = request.url.replace(/^local-resource:\/\//, '');
    // Decode URL to prevent errors when loading filenames with UTF-8 chars or chars like "#"
    const decodedUrl = decodeURI(url); // Needed in case URL contains spaces
    try {
      return callback(decodedUrl);
    } catch (error) {
      console.error(
        'ERROR: registerLocalResourceProtocol: Could not get file path:',
        error
      );
    }
  });
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Create tray variable in global scope with null to avoid garbage collection.
let tray = null;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS);
    } catch (e: any) {
      console.error('Vue Devtools failed to install:', e.toString());
    }
  }
  // Set app model id for Windows with name of application
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.name);
  }
  registerLocalResourceProtocol();
  createWindow();
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
