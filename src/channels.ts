/**
 * An enum used for `ipcRenderer.send`.
 * ```
 * window.ipcRenderer.send(SChannel.example, data: any);
 * ```
 */
export enum SChannel {
  empty = "",
}

/**
 * An enum used for asynchronous `ipcRenderer.invoke`.
 * ```
 * await window.ipcRenderer.invoke(IChannel.wallet);
 * ```
 */
export enum IChannel {
  currentSummoner = "current-summoner",
  wallet = "wallet",
  playerLootMap = "playerLootMap",
  contextMenu = "context-menu",
  craft = "craft",
  profileIcon = "dd-profile-icon",
  lootTranslation = "cd-loot-translation",
  tileIcon = "cd-tile-icon",
  minimizeWindow = "app-minimize-window",
  exitApplication = "app-exit-application",
  getStore = "app-get-store",
  setStore = "app-set-store",
}

/**
 * An enum used for `ipcRenderer.receive`.
 * ```
 * window.ipcRenderer.receive(RChannel.needleworkUpdate, (): any => void);
 * ```
 */
export enum RChannel {
  needleworkUpdate = "needlework-update",
}

/**
 * An enum used for `ipcRenderer.once`.
 * ```
 * window.ipcRenderer.once(RChannel.example, (): any => void);
 * ```
 */
export enum OChannel {
  empty = "",
}