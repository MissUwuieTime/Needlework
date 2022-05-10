import Needlework from '../apis/needlework';
import { BrowserWindow, ipcMain } from 'electron';
import { MessageDTO } from '@/types/MessageDTO';
import { IChannel, RChannel } from '@/channels';

const POLL_PERIOD = 2500;

export default class NeedleworkService {
  needlework: null | Needlework;
  win: null | BrowserWindow;

  constructor() {
    this.needlework = null;
    this.win = null;
  }

  async initialize(window: BrowserWindow) {
    const needlework = new Needlework(POLL_PERIOD);
    await needlework.initialize();
    this.needlework = needlework;
    this.win = window;

    this.currentSummonerHandler();
    this.walletHandler();
    this.playerLootMapHandler();
    this.handleContextMenu();
    this.handleCraft();
    this.needlework.setUpdateEventCallback(
      this.handleNeedleworkUpdate.bind(this)
    );
    this.handleIsClientActive();
  }

  handleNeedleworkUpdate(messageDTO: MessageDTO) {
    this.win?.webContents.send(
      RChannel.needleworkUpdate,
      messageDTO.object.uri
    );
  }

  currentSummonerHandler() {
    ipcMain.handle(IChannel.currentSummoner, (event, args) => {
      return this.needlework?.currentSummoner();
    });
  }

  walletHandler() {
    ipcMain.handle(IChannel.wallet, (event, args) => {
      return this.needlework?.wallet();
    });
  }

  playerLootMapHandler() {
    ipcMain.handle(IChannel.playerLootMap, (event, args) => {
      return this.needlework?.playerLootMap();
    });
  }

  handleContextMenu() {
    ipcMain.handle('context-menu', (event, data) => {
      return this.needlework?.contextMenu(data);
    });
  }

  handleCraft() {
    ipcMain.handle(
      'craft',
      (
        event,
        {
          recipeName,
          lootId,
          repeat,
        }: { recipeName: string; lootId: string; repeat: number }
      ) => {
        return this.needlework?.craft(recipeName, lootId, repeat);
      }
    );
  }

  handleIsClientActive() {
    ipcMain.handle(IChannel.isClientActive, (event) => {
      return this.needlework?.isClientActive() ?? false;
    });
  }
}
